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
import type { ListSprintTasksQueryDto } from './dto/list-sprint-tasks-query.dto.js';
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

  async search(query: string) {
    const escapedQuery = query.replace(/[!%_]/g, '!$&');
    const containsPattern = `%${escapedQuery}%`;
    const prefixPattern = `${escapedQuery}%`;

    return this.prisma.$queryRaw<
      {
        id: string;
        taskKey: string;
        title: string;
        description: string | null;
        sprintId: string | null;
        sprintName: string | null;
      }[]
    >`
      SELECT
        task."id",
        task."task_key" AS "taskKey",
        task."title",
        left(task."description", 180) AS "description",
        task."sprint_id" AS "sprintId",
        sprint."name" AS "sprintName"
      FROM "tasks" task
      LEFT JOIN "sprints" sprint ON sprint."id" = task."sprint_id"
      WHERE task."deleted_at" IS NULL
        AND (
          task."task_key" ILIKE ${containsPattern} ESCAPE '!'
          OR task."title" ILIKE ${containsPattern} ESCAPE '!'
          OR task."description" ILIKE ${containsPattern} ESCAPE '!'
        )
      ORDER BY
        CASE
          WHEN lower(task."task_key") = lower(${query}) THEN 0
          WHEN lower(task."task_key") LIKE lower(${prefixPattern}) ESCAPE '!' THEN 1
          WHEN lower(task."title") = lower(${query}) THEN 2
          WHEN lower(task."title") LIKE lower(${prefixPattern}) ESCAPE '!' THEN 3
          WHEN task."task_key" ILIKE ${containsPattern} ESCAPE '!' THEN 4
          WHEN task."title" ILIKE ${containsPattern} ESCAPE '!' THEN 5
          ELSE 6
        END,
        task."task_key" ASC,
        task."id" ASC
      LIMIT 8
    `;
  }

  async listSprintTasks(sprintId: string, query: ListSprintTasksQueryDto) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: { id: true, name: true, status: true },
    });
    if (!sprint) throw new NotFoundException('Sprint not found.');

    const where = { sprintId, deletedAt: null };
    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [
          { [query.sortBy]: query.sortOrder },
          { taskKey: 'asc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      sprint,
      tasks,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getSprintBoard(sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      select: {
        id: true,
        name: true,
        status: true,
        teamId: true,
        team: {
          select: {
            members: {
              where: { user: { isActive: true } },
              select: {
                user: { select: { id: true, name: true } },
              },
              orderBy: { user: { name: 'asc' } },
            },
          },
        },
        tasks: {
          where: { deletedAt: null },
          include: {
            ...taskInclude,
            prerequisites: {
              select: {
                dependsOnTask: {
                  select: {
                    id: true,
                    taskKey: true,
                    status: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
          orderBy: { taskKey: 'asc' },
        },
      },
    });
    if (!sprint) throw new NotFoundException('Sprint not found.');

    const teamMemberIds = new Set(
      sprint.team?.members.map(({ user: member }) => member.id) ?? [],
    );
    const assigneeMap = new Map<string, { id: string; name: string }>();
    for (const task of sprint.tasks) {
      if (task.assignee) {
        assigneeMap.set(task.assignee.id, {
          id: task.assignee.id,
          name: task.assignee.name,
        });
      }
    }

    const activeTeamMembers = sprint.team
      ? sprint.team.members.map(({ user: member }) => member)
      : [...assigneeMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const outsideTeamAssignees = [...assigneeMap.values()]
      .filter(({ id }) => !teamMemberIds.has(id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        status: sprint.status,
        teamId: sprint.teamId,
      },
      tasks: sprint.tasks,
      activeTeamMembers,
      outsideTeamAssignees,
    };
  }

  async getByKey(taskKey: string) {
    const task = await this.prisma.task.findFirst({
      where: { taskKey, deletedAt: null },
      include: taskInclude,
    });
    if (!task) throw new NotFoundException('Task not found.');
    return task;
  }

  async listDependencies(id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('Task not found.');

    return this.prisma.taskDependency.findMany({
      where: { taskId: id },
      include: {
        dependsOnTask: {
          select: {
            id: true,
            taskKey: true,
            title: true,
            status: true,
            deletedAt: true,
            sprintId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addDependency(id: string, dependsOnTaskId: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await this.lockDependencyGraph(transaction);
        const dependent = await this.getEditableTask(transaction, id);
        if (id === dependsOnTaskId) {
          throw new BadRequestException('A task cannot depend on itself.');
        }

        const prerequisite = await transaction.task.findFirst({
          where: { id: dependsOnTaskId },
          select: {
            id: true,
            taskKey: true,
            status: true,
            deletedAt: true,
          },
        });
        if (!prerequisite || prerequisite.deletedAt) {
          throw new NotFoundException('Active prerequisite task not found.');
        }
        if (dependent.status === 'DONE' && prerequisite.status !== 'DONE') {
          throw new ConflictException(
            `Cannot add ${prerequisite.taskKey} as a prerequisite because ${dependent.taskKey} is already Done.`,
          );
        }

        const cycle = await transaction.$queryRaw<{ cycle: boolean }[]>`
          WITH RECURSIVE prerequisite_path("task_id") AS (
            SELECT ${dependsOnTaskId}::uuid
            UNION
            SELECT dependency."depends_on_task_id"
            FROM "task_dependencies" dependency
            JOIN prerequisite_path path
              ON dependency."task_id" = path."task_id"
          )
          SELECT EXISTS (
            SELECT 1 FROM prerequisite_path
            WHERE "task_id" = ${id}::uuid
          ) AS "cycle"
        `;
        if (cycle[0]?.cycle) {
          throw new BadRequestException(
            'This dependency would create a circular task dependency.',
          );
        }

        return transaction.taskDependency.create({
          data: { taskId: id, dependsOnTaskId },
          include: {
            dependsOnTask: {
              select: {
                id: true,
                taskKey: true,
                title: true,
                status: true,
                deletedAt: true,
                sprintId: true,
              },
            },
          },
        });
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This prerequisite is already added.');
      }
      throw error;
    }
  }

  async removeDependency(id: string, dependencyId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockDependencyGraph(transaction);
      const task = await this.getEditableTask(transaction, id);
      const dependency = await transaction.taskDependency.findFirst({
        where: { id: dependencyId, taskId: id },
        select: { id: true },
      });
      if (!dependency) {
        throw new NotFoundException('Task dependency not found.');
      }
      await transaction.taskDependency.delete({ where: { id: dependencyId } });
      return { removed: true, taskId: task.id };
    });
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
      if (input.status !== undefined) {
        await this.lockDependencyGraph(transaction);
      }
      const snapshot = await transaction.task.findFirst({
        where: { id, deletedAt: null },
        select: { sprintId: true, status: true, taskKey: true },
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

      const nextStatus: TaskStatus = input.status ?? current.status;
      if (current.status !== nextStatus && nextStatus === 'DONE') {
        await this.assertPrerequisitesDone(transaction, id, current.taskKey);
      }
      if (current.status === 'DONE' && nextStatus !== 'DONE') {
        await this.assertNoDoneDependents(transaction, id, current.taskKey);
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
      await this.lockDependencyGraph(transaction);
      const snapshot = await transaction.task.findFirst({
        where: { id, deletedAt: null },
        select: { sprintId: true, taskKey: true },
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
      await this.assertNoDoneDependents(transaction, id, snapshot.taskKey);

      await transaction.task.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      return { deleted: true };
    });
  }

  private async getEditableTask(
    transaction: Prisma.TransactionClient,
    id: string,
  ) {
    const snapshot = await transaction.task.findFirst({
      where: { id, deletedAt: null },
      select: { sprintId: true },
    });
    if (!snapshot) throw new NotFoundException('Task not found.');
    const sprintIds = snapshot.sprintId ? [snapshot.sprintId] : [];
    await this.lockSprints(transaction, sprintIds);
    const task = await this.lockAndReadTask(transaction, id);
    if (task.sprintId !== snapshot.sprintId) {
      throw new ConflictException(
        'The task changed while its dependencies were being updated. Refresh and try again.',
      );
    }
    await this.assertSprintsEditable(transaction, sprintIds);
    return task;
  }

  private async assertPrerequisitesDone(
    transaction: Prisma.TransactionClient,
    taskId: string,
    taskKey: string,
  ): Promise<void> {
    const blocking = await transaction.taskDependency.findMany({
      where: { taskId },
      select: {
        dependsOnTask: {
          select: { taskKey: true, status: true, deletedAt: true },
        },
      },
      orderBy: { dependsOnTask: { taskKey: 'asc' } },
    });
    const taskKeys = blocking
      .filter(
        ({ dependsOnTask }) =>
          dependsOnTask.deletedAt !== null || dependsOnTask.status !== 'DONE',
      )
      .map(({ dependsOnTask }) => dependsOnTask.taskKey);
    if (taskKeys.length) {
      throw new ConflictException(
        `Cannot complete ${taskKey}. ${taskKeys.join(', ')} must be completed first.`,
      );
    }
  }

  private async assertNoDoneDependents(
    transaction: Prisma.TransactionClient,
    taskId: string,
    taskKey: string,
  ): Promise<void> {
    const dependents = await transaction.taskDependency.findMany({
      where: {
        dependsOnTaskId: taskId,
        task: { status: 'DONE', deletedAt: null },
      },
      select: { task: { select: { taskKey: true } } },
      orderBy: { task: { taskKey: 'asc' } },
    });
    const taskKeys = dependents.map(({ task }) => task.taskKey);
    if (taskKeys.length) {
      throw new ConflictException(
        `Cannot change ${taskKey}. Completed dependent tasks ${taskKeys.join(', ')} rely on it.`,
      );
    }
  }

  private async lockDependencyGraph(
    transaction: Prisma.TransactionClient,
  ): Promise<void> {
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(72411001::bigint)::text AS "locked"
    `;
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
        status: true,
        taskKey: true,
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
