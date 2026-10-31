import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateMemberDto } from './dto/create-member.dto.js';
import type { UpdateMemberDto } from './dto/update-member.dto.js';

const publicMemberSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: publicMemberSelect,
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
  }

  async listAssigneeOptions() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(input: CreateMemberDto) {
    try {
      return await this.prisma.user.create({
        data: {
          name: input.name.trim(),
          email: input.email.trim().toLowerCase(),
          role: input.role,
        },
        select: publicMemberSelect,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A member with this email already exists.');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateMemberDto) {
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const current = await transaction.user.findUnique({
            where: { id },
            select: { id: true, role: true, isActive: true },
          });
          if (!current) {
            throw new NotFoundException('Member not found.');
          }

          const nextRole = input.role ?? current.role;
          const nextIsActive = input.isActive ?? current.isActive;
          if (
            current.role === 'ADMIN' &&
            current.isActive &&
            (nextRole !== 'ADMIN' || !nextIsActive)
          ) {
            await this.ensureAnotherActiveAdmin(transaction, current.id);
          }

          const updated = await transaction.user.update({
            where: { id },
            data: {
              ...(input.name !== undefined ? { name: input.name.trim() } : {}),
              ...(input.email !== undefined
                ? { email: input.email.trim().toLowerCase() }
                : {}),
              ...(input.role !== undefined ? { role: input.role } : {}),
              ...(input.isActive !== undefined
                ? { isActive: input.isActive }
                : {}),
            },
            select: publicMemberSelect,
          });

          if (current.isActive && !nextIsActive) {
            await transaction.userSession.updateMany({
              where: { userId: id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
            await transaction.teamMember.deleteMany({ where: { userId: id } });
          }

          return updated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A member with this email already exists.');
      }
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'Member permissions changed concurrently. Refresh and try again.',
        );
      }
      throw error;
    }
  }

  async deactivate(id: string) {
    return this.update(id, { isActive: false });
  }

  async activate(id: string) {
    return this.update(id, { isActive: true });
  }

  async permanentlyDelete(id: string, requestingAdminId: string) {
    if (id === requestingAdminId) {
      throw new ConflictException(
        'You cannot permanently delete your own account. Ask another administrator to do this.',
      );
    }

    try {
      await this.prisma.$transaction(
        async (transaction) => {
          const member = await transaction.user.findUnique({
            where: { id },
            select: { id: true, role: true, isActive: true },
          });
          if (!member) {
            throw new NotFoundException('Member not found.');
          }

          if (member.role === 'ADMIN' && member.isActive) {
            await this.ensureAnotherActiveAdmin(transaction, member.id);
          }

          await transaction.user.delete({ where: { id } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { deleted: true };
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'Administrator permissions changed concurrently. Refresh and try again.',
        );
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Member not found.');
      }
      throw error;
    }
  }

  private async ensureAnotherActiveAdmin(
    transaction: Prisma.TransactionClient,
    currentId: string,
  ): Promise<void> {
    const activeAdmins = await transaction.user.count({
      where: {
        role: 'ADMIN',
        isActive: true,
        id: { not: currentId },
      },
    });
    if (activeAdmins < 1) {
      throw new ConflictException(
        'At least one active administrator must remain.',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }
}

export type MemberRecord = Pick<
  User,
  'id' | 'name' | 'email' | 'role' | 'isActive' | 'createdAt' | 'updatedAt'
>;
export type MemberRole = UserRole;
