import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { SprintStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSprintDto } from './dto/create-sprint.dto.js';
import type { UpdateSprintDto } from './dto/update-sprint.dto.js';

const sprintInclude = {
  team: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.SprintInclude;

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

@Injectable()
export class SprintsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.sprint.findMany({
      include: sprintInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(id: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        ...sprintInclude,
        tasks: {
          select: { taskKey: true, status: true },
          orderBy: { taskKey: 'asc' },
        },
      },
    });
    if (!sprint) {
      throw new NotFoundException('Sprint not found.');
    }
    const { tasks, ...details } = sprint;
    return {
      ...details,
      taskProgress: {
        total: tasks.length,
        done: tasks.filter(({ status }) => status === 'DONE').length,
        unfinishedTaskKeys: tasks
          .filter(({ status }) => status !== 'DONE')
          .map(({ taskKey }) => taskKey),
      },
    };
  }

  async create(input: CreateSprintDto, user: AuthenticatedUser) {
    this.assertDateRange(input.startDate, input.endDate);
    if (input.teamId) {
      await this.assertTeamExists(input.teamId);
    }
    return this.prisma.sprint.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        teamId: input.teamId ?? null,
        startDate: parseDate(input.startDate),
        endDate: parseDate(input.endDate),
        createdById: user.id,
      },
      include: sprintInclude,
    });
  }

  async update(id: string, input: UpdateSprintDto) {
    const current = await this.prisma.sprint.findUnique({
      where: { id },
      select: { id: true, startDate: true, endDate: true, status: true },
    });
    if (!current) {
      throw new NotFoundException('Sprint not found.');
    }
    if (current.status === 'COMPLETED') {
      throw new ConflictException('Reopen the sprint before editing it.');
    }

    const startDate = input.startDate
      ? parseDate(input.startDate)
      : current.startDate;
    const endDate = input.endDate ? parseDate(input.endDate) : current.endDate;
    this.assertDateRange(startDate, endDate);

    if (input.teamId) {
      await this.assertTeamExists(input.teamId);
    }

    return this.prisma.sprint.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
        ...(input.startDate !== undefined ? { startDate } : {}),
        ...(input.endDate !== undefined ? { endDate } : {}),
      },
      include: sprintInclude,
    });
  }

  async start(id: string) {
    return this.setStatus(id, 'ACTIVE');
  }

  async moveToPlanned(id: string) {
    return this.setStatus(id, 'PLANNED');
  }

  async reopen(id: string) {
    return this.setStatus(id, 'ACTIVE');
  }

  async setStatus(id: string, status: SprintStatus) {
    try {
      await this.prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
            SELECT pg_advisory_xact_lock(72411001::bigint)::text AS "locked"
          `;
          const lockedSprint = await transaction.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "sprints" WHERE "id" = ${id}::uuid FOR UPDATE
          `;
          if (lockedSprint.length === 0) {
            throw new NotFoundException('Sprint not found.');
          }
          const sprint = await transaction.sprint.findUnique({
            where: { id },
            select: { id: true, name: true, status: true },
          });
          if (!sprint) {
            throw new NotFoundException('Sprint not found.');
          }

          if (status === 'COMPLETED') {
            const unfinished = await transaction.task.findMany({
              where: {
                sprintId: id,
                status: { not: 'DONE' },
              },
              select: { taskKey: true },
              orderBy: { taskKey: 'asc' },
            });
            if (unfinished.length > 0) {
              const taskKeys = unfinished.map(({ taskKey }) => taskKey).join(', ');
              throw new ConflictException(
                `Cannot complete ${sprint.name}. These tasks are not done: ${taskKeys}.`,
              );
            }
          }

          await transaction.sprint.update({
            where: { id },
            data: { status },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'The sprint or its tasks changed while updating status. Refresh and try again.',
        );
      }
      if (this.isMissingRecord(error)) {
        throw new NotFoundException('Sprint not found.');
      }
      throw error;
    }

    return this.get(id);
  }

  async delete(id: string) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const lockedSprint = await transaction.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "sprints" WHERE "id" = ${id}::uuid FOR UPDATE
        `;
        if (lockedSprint.length === 0) {
          throw new NotFoundException('Sprint not found.');
        }
        const sprint = await transaction.sprint.findUnique({
          where: { id },
          select: { id: true, status: true },
        });
        if (!sprint) {
          throw new NotFoundException('Sprint not found.');
        }
        if (sprint.status === 'COMPLETED') {
          throw new ConflictException('Reopen the sprint before deleting it.');
        }

        await transaction.task.updateMany({
          where: { sprintId: id },
          data: { sprintId: null },
        });

        await transaction.sprint.delete({ where: { id } });
      });
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        throw new ConflictException(
          'The sprint changed while it was being deleted. Refresh and try again.',
        );
      }
      if (this.isMissingRecord(error)) {
        throw new NotFoundException('Sprint not found.');
      }
      throw error;
    }
    return { deleted: true };
  }

  private async assertTeamExists(teamId: string): Promise<void> {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });
    if (!team) {
      throw new BadRequestException('The selected team does not exist.');
    }
  }

  private assertDateRange(start: string | Date, end: string | Date): void {
    const startDate = typeof start === 'string' ? parseDate(start) : start;
    const endDate = typeof end === 'string' ? parseDate(end) : end;
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      throw new BadRequestException(
        'The sprint end date cannot be before its start date.',
      );
    }
  }

  private isSerializationFailure(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private isMissingRecord(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
