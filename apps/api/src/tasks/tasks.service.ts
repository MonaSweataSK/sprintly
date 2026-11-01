import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { TaskStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';

const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  sprint: { select: { id: true, name: true, status: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

function parseDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  return typeof value === 'string'
    ? new Date(`${value}T00:00:00.000Z`)
    : value;
}

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list(sprintId?: string) {
    return this.prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(sprintId ? { sprintId } : {}),
      },
      include: taskInclude,
      orderBy: [{ createdAt: 'desc' }, { taskKey: 'asc' }],
    });
  }

  listBacklog() {
    return this.prisma.task.findMany({
      where: { sprintId: null, deletedAt: null },
      include: taskInclude,
      orderBy: [{ createdAt: 'desc' }, { taskKey: 'asc' }],
    });
  }

  async getByKey(taskKey: string) {
    const task = await this.prisma.task.findFirst({
      where: { taskKey, deletedAt: null },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Task not found.');
    return task;
  }

  async create(input: CreateTaskDto, user: AuthenticatedUser) {
    const startDate = parseDate(input.startDate);
    const endDate = parseDate(input.endDate);
    this.assertDateRange(startDate, endDate);

    return this.prisma.$transaction(async (transaction) => {
      if (input.sprintId) {
        await this.lockSprints(transaction, [input.sprintId]);
        await this.assertSprintsEditable(transaction, [input.sprintId]);
      }
      if (input.assigneeId) {
        await this.assertAssigneeActive(transaction, input.assigneeId);
      }

      return transaction.task.create({
        data: {
          title: input.title.trim(),
          description: input.description?.trim() || null,
          assigneeId: input.assigneeId ?? null,
          sprintId: input.sprintId ?? null,
          startDate,
          endDate,
          status: input.status ?? 'TODO',
          createdById: user.id,
        },
        include: taskInclude,
      });
    });
  }

  async update(id: string, input: UpdateTaskDto) {
    return this.prisma.$transaction(async (transaction) => {
      const snapshot = await transaction.task.findFirst({
        where: { id, deletedAt: null },
        select: { sprintId: true },
      });
      if (!snapshot) throw new NotFoundException('Task not found.');

      const nextSprintId =
        input.sprintId === undefined ? snapshot.sprintId : input.sprintId;
      const sprintIds = [snapshot.sprintId, nextSprintId].filter(
        (value): value is string => value !== null,
      );
      await this.lockSprints(transaction, sprintIds);

      const current = await this.lockAndReadTask(transaction, id);
      if (current.sprintId !== snapshot.sprintId) {
        throw new ConflictException(
          'The task changed while it was being updated. Refresh and try again.',
        );
      }
      await this.assertSprintsEditable(transaction, sprintIds);

      const startDate =
        input.startDate === undefined
          ? current.startDate
          : parseDate(input.startDate);
      const endDate =
        input.endDate === undefined ? current.endDate : parseDate(input.endDate);
      this.assertDateRange(startDate, endDate);

      if (input.assigneeId) {
        await this.assertAssigneeActive(transaction, input.assigneeId);
      }

      return transaction.task.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.assigneeId !== undefined
            ? { assigneeId: input.assigneeId }
            : {}),
          ...(input.sprintId !== undefined ? { sprintId: input.sprintId } : {}),
          ...(input.startDate !== undefined ? { startDate } : {}),
          ...(input.endDate !== undefined ? { endDate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        include: taskInclude,
      });
    });
  }

  async softDelete(id: string) {
    return this.prisma.$transaction(async (transaction) => {
      const snapshot = await transaction.task.findFirst({
        where: { id, deletedAt: null },
        select: { sprintId: true },
      });
      if (!snapshot) throw new NotFoundException('Task not found.');

      const sprintIds = snapshot.sprintId ? [snapshot.sprintId] : [];
      await this.lockSprints(transaction, sprintIds);
      const current = await this.lockAndReadTask(transaction, id);
      if (current.sprintId !== snapshot.sprintId) {
        throw new ConflictException(
          'The task changed while it was being deleted. Refresh and try again.',
        );
      }
      await this.assertSprintsEditable(transaction, sprintIds);

      await transaction.task.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { deleted: true };
    });
  }

  private async lockSprints(
    transaction: Prisma.TransactionClient,
    sprintIds: string[],
  ): Promise<void> {
    for (const sprintId of [...new Set(sprintIds)].sort()) {
      const rows = await transaction.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "sprints" WHERE "id" = ${sprintId}::uuid FOR UPDATE
      `;
      if (rows.length === 0) throw new BadRequestException('Sprint not found.');
    }
  }

  private async assertSprintsEditable(
    transaction: Prisma.TransactionClient,
    sprintIds: string[],
  ): Promise<void> {
    if (!sprintIds.length) return;
    const completed = await transaction.sprint.findMany({
      where: { id: { in: sprintIds }, status: 'COMPLETED' },
      select: { name: true },
    });
    if (completed.length) {
      throw new ConflictException(
        `Reopen ${completed.map(({ name }) => name).join(', ')} before changing its tasks.`,
      );
    }
  }

  private async lockAndReadTask(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    await transaction.$queryRaw`
      SELECT "id" FROM "tasks" WHERE "id" = ${id}::uuid AND "deleted_at" IS NULL FOR UPDATE
    `;
    const task = await transaction.task.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        sprintId: true,
        startDate: true,
        endDate: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found.');
    return task;
  }

  private async assertAssigneeActive(
    transaction: Prisma.TransactionClient,
    assigneeId: string,
  ): Promise<void> {
    const assignee = await transaction.user.findFirst({
      where: { id: assigneeId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      throw new BadRequestException(
        'The assignee must be an active organization member.',
      );
    }
  }

  private assertDateRange(
    startDate: Date | null,
    endDate: Date | null,
  ): void {
    if (
      (startDate && Number.isNaN(startDate.getTime())) ||
      (endDate && Number.isNaN(endDate.getTime()))
    ) {
      throw new BadRequestException('Task dates must be valid calendar dates.');
    }
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException(
        'The task end date cannot be before its start date.',
      );
    }
  }
}
