import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TeamsService } from './teams.service.js';

const team = {
  id: 'team-id',
  name: 'Product',
  description: null,
  createdAt: new Date(),
  members: [],
};

describe('TeamsService', () => {
  let service: TeamsService;
  let transaction: {
    user: { count: ReturnType<typeof vi.fn> };
    team: {
      create: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
    };
    teamMember: { createMany: ReturnType<typeof vi.fn> };
  };
  let prisma: {
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    transaction = {
      user: { count: vi.fn().mockResolvedValue(1) },
      team: {
        create: vi.fn().mockResolvedValue(team),
        findUniqueOrThrow: vi.fn().mockResolvedValue(team),
      },
      teamMember: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma = {
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    service = new TeamsService(prisma as unknown as PrismaService);
  });

  it('creates teams with normalized names and active memberships', async () => {
    await service.create({
      name: '  Product ',
      description: '  Platform team ',
      memberIds: ['member-id'],
    });

    expect(transaction.team.create).toHaveBeenCalledWith({
      data: { name: 'Product', description: 'Platform team' },
    });
    expect(transaction.teamMember.createMany).toHaveBeenCalledWith({
      data: [{ teamId: team.id, userId: 'member-id' }],
    });
  });

  it('rejects inactive users in team membership changes', async () => {
    transaction.user.count.mockResolvedValue(0);

    await expect(
      service.create({ name: 'Product', memberIds: ['inactive-member'] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(transaction.team.create).not.toHaveBeenCalled();
  });
});
