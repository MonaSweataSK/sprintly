import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from './tasks.service.js';

const user: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'member@example.com',
  name: 'Test Member',
  role: 'USER',
  sessionId: 'session-id',
};

const sprintId = '00000000-0000-4000-8000-000000000002';
const taskId = '00000000-0000-4000-8000-000000000003';
const task = {
  id: taskId,
  sprintId,
  startDate: null,
  endDate: null,
  taskKey: 'TASK-101',
  title: 'Build task management',
  description: null,
  assigneeId: null,
  status: 'TODO',
  createdById: user.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  assignee: null,
  sprint: { id: sprintId, name: 'Sprint One', status: 'ACTIVE' },
  createdBy: { id: user.id, name: user.name },
};

describe('TasksService', () => {
  let service: TasksService;
  let transaction: {
    task: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    taskDependency: {
      findMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    sprint: { findMany: ReturnType<typeof vi.fn> };
    user: { findFirst: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    sprint: { findUnique: ReturnType<typeof vi.fn> };
    task: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    taskDependency: { findMany: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
    $transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    transaction = {
      task: {
        findFirst: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(task),
        update: vi.fn().mockResolvedValue(task),
      },
      taskDependency: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({ id: 'dependency-id' }),
        create: vi.fn().mockResolvedValue({
          id: 'dependency-id',
          taskId,
          dependsOnTaskId: '00000000-0000-4000-8000-000000000004',
        }),
        delete: vi.fn().mockResolvedValue({ id: 'dependency-id' }),
      },
      sprint: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: user.id }) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: sprintId }]),
    };
    prisma = {
      sprint: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      task: {
        findFirst: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([task]),
        count: vi.fn().mockResolvedValue(1),
      },
      taskDependency: { findMany: vi.fn().mockResolvedValue([]) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(
        async (callback: (tx: typeof transaction) => unknown) =>
          callback(transaction),
      ),
    };
    service = new TasksService(prisma as unknown as PrismaService);
  });

  it('creates a task in the backlog with a database-generated key', async () => {
    await service.create({ title: '  Write tests  ' }, user);

    expect(transaction.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Write tests',
          sprintId: null,
          status: 'TODO',
          createdById: user.id,
        }),
      }),
    );
    expect(transaction.task.create.mock.calls[0][0].data).not.toHaveProperty(
      'taskKey',
    );
  });

  it('locks and validates the sprint before creating a task in it', async () => {
    await service.create({ title: 'A task', sprintId }, user);

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.task.create).toHaveBeenCalledOnce();
  });

  it('rejects a task date range where the end precedes the start', async () => {
    await expect(
      service.create(
        {
          title: 'Invalid dates',
          startDate: '2026-10-10',
          endDate: '2026-10-09',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects assignment to an inactive or missing member', async () => {
    transaction.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ title: 'Assigned task', assigneeId: user.id }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects mutations to a completed sprint', async () => {
    transaction.sprint.findMany.mockResolvedValueOnce([
      { name: 'Sprint One' },
    ]);

    await expect(
      service.update(taskId, { title: 'Edited title' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.task.update).not.toHaveBeenCalled();
  });

  it('rejects sprint assignment if the sprint is completed', async () => {
    transaction.sprint.findMany.mockResolvedValueOnce([
      { name: 'Sprint One' },
    ]);

    await expect(
      service.create({ title: 'New task', sprintId }, user),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.task.create).not.toHaveBeenCalled();
  });

  it('lists only active tasks in the backlog', async () => {
    await service.listBacklog();

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sprintId: null, deletedAt: null },
      }),
    );
  });

  it('searches active tasks across sprint and backlog with bounded ranked results', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: task.id,
        taskKey: task.taskKey,
        title: task.title,
        description: task.description,
        sprintId: task.sprintId,
        sprintName: task.sprint.name,
      },
    ]);

    await expect(service.search(' task_101 ')).resolves.toEqual([
      {
        id: task.id,
        taskKey: task.taskKey,
        title: task.title,
        description: task.description,
        sprintId: task.sprintId,
        sprintName: task.sprint.name,
      },
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    const queryFragments = prisma.$queryRaw.mock.calls[0][0].join('?');
    expect(queryFragments).toContain('"deleted_at" IS NULL');
    expect(queryFragments).toContain('LIMIT 8');
    expect(queryFragments).toContain('ORDER BY');
  });

  it('returns a stable, paginated list of active tasks for an existing sprint', async () => {
    prisma.sprint.findUnique.mockResolvedValueOnce({
      id: sprintId,
      name: 'Sprint One',
      status: 'ACTIVE',
    });

    const result = await service.listSprintTasks(sprintId, {
      page: 2,
      pageSize: 10,
      sortBy: 'title',
      sortOrder: 'desc',
    });

    expect(result).toEqual({
      sprint: { id: sprintId, name: 'Sprint One', status: 'ACTIVE' },
      tasks: [task],
      pagination: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sprintId, deletedAt: null },
        orderBy: [{ title: 'desc' }, { taskKey: 'asc' }, { id: 'asc' }],
        skip: 10,
        take: 10,
      }),
    );
    expect(prisma.task.count).toHaveBeenCalledWith({
      where: { sprintId, deletedAt: null },
    });
  });

  it('rejects paginated lists for a missing sprint', async () => {
    await expect(
      service.listSprintTasks(sprintId, {
        page: 1,
        pageSize: 20,
        sortBy: 'taskKey',
        sortOrder: 'asc',
      }),
    ).rejects.toThrow('Sprint not found.');
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('returns team members with empty columns and outside-team assignees', async () => {
    const outsideUserId = '00000000-0000-4000-8000-000000000005';
    const teamUserId = '00000000-0000-4000-8000-000000000006';
    prisma.sprint.findUnique.mockResolvedValueOnce({
      id: sprintId,
      name: 'Sprint One',
      status: 'ACTIVE',
      teamId: '00000000-0000-4000-8000-000000000007',
      team: {
        members: [{ user: { id: teamUserId, name: 'Team member' } }],
      },
      tasks: [
        {
          ...task,
          assigneeId: outsideUserId,
          assignee: { id: outsideUserId, name: 'Outside member', email: 'outside@example.com' },
          prerequisites: [],
        },
      ],
    });

    const board = await service.getSprintBoard(sprintId);

    expect(board.activeTeamMembers).toEqual([
      { id: teamUserId, name: 'Team member' },
    ]);
    expect(board.outsideTeamAssignees).toEqual([
      { id: outsideUserId, name: 'Outside member' },
    ]);
    expect(board.tasks).toHaveLength(1);
  });

  it('rejects a task as its own prerequisite', async () => {
    await expect(
      service.addDependency(taskId, taskId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.taskDependency.create).not.toHaveBeenCalled();
  });

  it('rejects circular dependency edges', async () => {
    transaction.$queryRaw
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{ id: sprintId }])
      .mockResolvedValueOnce([{ id: taskId }])
      .mockResolvedValueOnce([{ cycle: true }]);

    await expect(
      service.addDependency(taskId, '00000000-0000-4000-8000-000000000004'),
    ).rejects.toThrow('circular');
    expect(transaction.taskDependency.create).not.toHaveBeenCalled();
  });

  it('adds a valid prerequisite', async () => {
    transaction.task.findFirst
      .mockReset()
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce({
        id: '00000000-0000-4000-8000-000000000004',
        taskKey: 'TASK-100',
        status: 'DONE',
        deletedAt: null,
      });

    await service.addDependency(
      taskId,
      '00000000-0000-4000-8000-000000000004',
    );

    expect(transaction.taskDependency.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          taskId,
          dependsOnTaskId: '00000000-0000-4000-8000-000000000004',
        },
      }),
    );
  });

  it('lists prerequisites including soft-deleted prerequisite records', async () => {
    prisma.taskDependency.findMany.mockResolvedValueOnce([
      {
        id: 'dependency-id',
        taskId,
        dependsOnTaskId: '00000000-0000-4000-8000-000000000004',
        dependsOnTask: {
          id: '00000000-0000-4000-8000-000000000004',
          taskKey: 'TASK-099',
          title: 'Deleted prerequisite',
          status: 'DONE',
          deletedAt: new Date(),
          sprintId: null,
        },
      },
    ]);

    const dependencies = await service.listDependencies(taskId);

    expect(dependencies[0].dependsOnTask.deletedAt).toBeInstanceOf(Date);
    expect(prisma.taskDependency.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { taskId } }),
    );
  });

  it('does not add an unfinished prerequisite to an already Done task', async () => {
    transaction.task.findFirst
      .mockReset()
      .mockResolvedValueOnce({ ...task, status: 'DONE' })
      .mockResolvedValueOnce({ ...task, status: 'DONE' })
      .mockResolvedValueOnce({
        id: '00000000-0000-4000-8000-000000000004',
        taskKey: 'TASK-100',
        status: 'TODO',
        deletedAt: null,
      });

    await expect(
      service.addDependency(
        taskId,
        '00000000-0000-4000-8000-000000000004',
      ),
    ).rejects.toThrow('already Done');
    expect(transaction.taskDependency.create).not.toHaveBeenCalled();
  });

  it('removes a prerequisite edge from an editable task', async () => {
    await service.removeDependency(taskId, 'dependency-id');

    expect(transaction.taskDependency.delete).toHaveBeenCalledWith({
      where: { id: 'dependency-id' },
    });
  });

  it('blocks task completion while a prerequisite is unfinished', async () => {
    transaction.taskDependency.findMany.mockResolvedValueOnce([
      {
        dependsOnTask: {
          taskKey: 'TASK-100',
          status: 'IN_PROGRESS',
          deletedAt: null,
        },
      },
    ]);

    await expect(service.update(taskId, { status: 'DONE' })).rejects.toThrow(
      'TASK-100 must be completed first',
    );
    expect(transaction.task.update).not.toHaveBeenCalled();
  });

  it('keeps deleted prerequisites blocking task completion', async () => {
    transaction.taskDependency.findMany.mockResolvedValueOnce([
      {
        dependsOnTask: {
          taskKey: 'TASK-099',
          status: 'DONE',
          deletedAt: new Date(),
        },
      },
    ]);

    await expect(service.update(taskId, { status: 'DONE' })).rejects.toThrow(
      'TASK-099 must be completed first',
    );
  });

  it('prevents reopening a prerequisite used by a completed task', async () => {
    transaction.task.findFirst
      .mockResolvedValueOnce({ ...task, status: 'DONE' })
      .mockResolvedValueOnce({ ...task, status: 'DONE' });
    transaction.taskDependency.findMany.mockResolvedValueOnce([
      { task: { taskKey: 'TASK-105' } },
    ]);

    await expect(service.update(taskId, { status: 'TODO' })).rejects.toThrow(
      'TASK-105',
    );
    expect(transaction.task.update).not.toHaveBeenCalled();
  });

  it('prevents deleting a prerequisite used by a completed task', async () => {
    transaction.taskDependency.findMany.mockResolvedValueOnce([
      { task: { taskKey: 'TASK-105' } },
    ]);

    await expect(service.softDelete(taskId)).rejects.toThrow('TASK-105');
    expect(transaction.task.update).not.toHaveBeenCalled();
  });
});
