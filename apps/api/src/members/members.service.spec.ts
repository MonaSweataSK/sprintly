import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { MembersService } from './members.service.js';

const member = {
  id: 'member-id',
  name: 'Workspace Admin',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MembersService', () => {
  let service: MembersService;
  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let transaction: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    userSession: { updateMany: ReturnType<typeof vi.fn> };
    teamMember: { deleteMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    transaction = {
      user: {
        findUnique: vi.fn().mockResolvedValue(member),
        count: vi.fn().mockResolvedValue(1),
        update: vi.fn().mockResolvedValue(member),
        delete: vi.fn().mockResolvedValue(member),
      },
      userSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      teamMember: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(member),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    service = new MembersService(prisma as unknown as PrismaService);
  });

  it('creates member emails in normalized form', async () => {
    await service.create({
      name: '  New Member  ',
      email: '  NEW@example.com ',
      role: UserRole.USER,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          name: 'New Member',
          email: 'new@example.com',
          role: UserRole.USER,
        },
      }),
    );
  });

  it('does not allow removing the last active administrator', async () => {
    transaction.user.count.mockResolvedValue(0);

    await expect(
      service.update(member.id, { isActive: false }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('revokes sessions and removes team memberships on deactivation', async () => {
    transaction.user.findUnique.mockResolvedValue({
      ...member,
      role: UserRole.USER,
    });
    transaction.user.update.mockResolvedValue({
      ...member,
      role: UserRole.USER,
      isActive: false,
    });

    await service.deactivate(member.id);

    expect(transaction.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: member.id, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(transaction.teamMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: member.id },
    });
  });

  it('prevents permanently deleting the last active administrator', async () => {
    transaction.user.count.mockResolvedValue(0);

    await expect(
      service.permanentlyDelete('other-admin-id', 'requesting-admin-id'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.user.delete).not.toHaveBeenCalled();
  });

  it('prevents an administrator from deleting their own account', async () => {
    await expect(
      service.permanentlyDelete(member.id, member.id),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('permanently deletes a member when another active admin remains', async () => {
    transaction.user.findUnique.mockResolvedValue({
      ...member,
      role: UserRole.USER,
    });

    await expect(
      service.permanentlyDelete('member-id', 'requesting-admin-id'),
    ).resolves.toEqual({ deleted: true });

    expect(transaction.user.delete).toHaveBeenCalledWith({
      where: { id: 'member-id' },
    });
  });
});
