import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTeamDto } from './dto/create-team.dto.js';
import type { UpdateTeamDto } from './dto/update-team.dto.js';

const teamInclude = {
  members: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      },
    },
  },
} satisfies Prisma.TeamInclude;

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.team.findMany({
      include: teamInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  listOptions() {
    return this.prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  async create(input: CreateTeamDto) {
    const memberIds = input.memberIds ?? [];
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.assertActiveMembers(transaction, memberIds);
        const team = await transaction.team.create({
          data: {
            name: input.name.trim(),
            description: input.description?.trim() || null,
          },
        });
        if (memberIds.length) {
          await transaction.teamMember.createMany({
            data: memberIds.map((userId) => ({ teamId: team.id, userId })),
          });
        }
        return transaction.team.findUniqueOrThrow({
          where: { id: team.id },
          include: teamInclude,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A team with this name already exists.');
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateTeamDto) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existing = await transaction.team.findUnique({ where: { id } });
        if (!existing) {
          throw new NotFoundException('Team not found.');
        }
        if (input.memberIds !== undefined) {
          await this.assertActiveMembers(transaction, input.memberIds);
        }

        await transaction.team.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.description !== undefined
              ? { description: input.description.trim() || null }
              : {}),
          },
        });

        if (input.memberIds !== undefined) {
          await transaction.teamMember.deleteMany({ where: { teamId: id } });
          if (input.memberIds.length) {
            await transaction.teamMember.createMany({
              data: input.memberIds.map((userId) => ({ teamId: id, userId })),
            });
          }
        }

        return transaction.team.findUniqueOrThrow({
          where: { id },
          include: teamInclude,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('A team with this name already exists.');
      }
      throw error;
    }
  }

  async addMember(teamId: string, userId: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.assertTeamExists(transaction, teamId);
        await this.assertActiveMembers(transaction, [userId]);
        await transaction.teamMember.create({ data: { teamId, userId } });
        return transaction.team.findUniqueOrThrow({
          where: { id: teamId },
          include: teamInclude,
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This member is already on the team.');
      }
      throw error;
    }
  }

  async removeMember(teamId: string, userId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.assertTeamExists(transaction, teamId);
      const membership = await transaction.teamMember.deleteMany({
        where: { teamId, userId },
      });
      if (membership.count === 0) {
        throw new NotFoundException('Team membership not found.');
      }
      return transaction.team.findUniqueOrThrow({
        where: { id: teamId },
        include: teamInclude,
      });
    });
  }

  async remove(id: string) {
    try {
      await this.prisma.team.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Team not found.');
      }
      throw error;
    }
    return { deleted: true };
  }

  private async assertTeamExists(
    transaction: Prisma.TransactionClient,
    teamId: string,
  ): Promise<void> {
    const team = await transaction.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException('Team not found.');
    }
  }

  private async assertActiveMembers(
    transaction: Prisma.TransactionClient,
    memberIds: string[],
  ): Promise<void> {
    if (memberIds.length === 0) {
      return;
    }
    const count = await transaction.user.count({
      where: { id: { in: memberIds }, isActive: true },
    });
    if (count !== memberIds.length) {
      throw new BadRequestException(
        'Teams can only include active members. Refresh the member list and try again.',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
