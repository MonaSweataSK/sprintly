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
    sprint: { findMany: ReturnType<typeof vi.fn> };
    user: { findFirst: ReturnType<typeof vi.fn> };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let prisma: {
    task: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
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
      sprint: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: user.id }) },
      $queryRaw: vi.fn().mockResolvedValue([{ id: sprintId }]),
    };
    prisma = {
      task: {
        findFirst: vi.fn().mockResolvedValue(task),
        findMany: vi.fn().mockResolvedValue([task]),
      },
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
});
