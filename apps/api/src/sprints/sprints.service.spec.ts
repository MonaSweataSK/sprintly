import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { SprintsService } from './sprints.service.js';

const user: AuthenticatedUser = {
  id: 'user-id',
  email: 'user@example.com',
  name: 'Test User',
  role: 'USER',
  sessionId: 'session-id',
};

const sprint = {
  id: 'sprint-id',
  name: 'Sprint One',
  description: null,
  teamId: null,
  startDate: new Date('2026-10-01T00:00:00.000Z'),
  endDate: new Date('2026-10-14T00:00:00.000Z'),
  status: 'PLANNED',
  createdById: user.id,
  createdAt: new Date(),
  updatedAt: new Date(),
  team: null,
  createdBy: { id: user.id, name: user.name },
  tasks: [],
};

describe('SprintsService', () => {
  let service: SprintsService;
  let prisma: {
    sprint: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    team: { findUnique: ReturnType<typeof vi.fn> };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let transaction: {
    sprint: {
      findUnique: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    task: {
      findMany: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
    $executeRaw: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    transaction = {
      sprint: {
        findUnique: vi.fn().mockResolvedValue(sprint),
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue(sprint),
        update: vi.fn().mockResolvedValue(sprint),
      },
      task: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ id: sprint.id }]),
      $executeRaw: vi.fn().mockResolvedValue(0),
    };
    prisma = {
      sprint: {
        findMany: vi.fn().mockResolvedValue([sprint]),
        findUnique: vi.fn().mockResolvedValue(sprint),
        create: vi.fn().mockResolvedValue(sprint),
        update: vi.fn().mockResolvedValue(sprint),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      team: { findUnique: vi.fn().mockResolvedValue({ id: 'team-id' }) },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    service = new SprintsService(prisma as unknown as PrismaService);
  });

  it('creates overlapping sprints with optional team assignment', async () => {
    await service.create(
      {
        name: 'Sprint One',
        startDate: '2026-10-01',
        endDate: '2026-10-14',
      },
      user,
    );
    await service.create(
      {
        name: 'Sprint Two',
        teamId: 'team-id',
        startDate: '2026-10-07',
        endDate: '2026-10-21',
      },
      user,
    );

    expect(prisma.sprint.create).toHaveBeenCalledTimes(2);
    expect(prisma.sprint.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        teamId: null,
        startDate: new Date('2026-10-01T00:00:00.000Z'),
        endDate: new Date('2026-10-14T00:00:00.000Z'),
        createdById: user.id,
      }),
    );
    expect(prisma.sprint.create.mock.calls[1][0].data.teamId).toBe('team-id');
  });

  it('rejects end dates before start dates', async () => {
    await expect(
      service.create(
        {
          name: 'Invalid sprint',
          startDate: '2026-10-15',
          endDate: '2026-10-14',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.sprint.create).not.toHaveBeenCalled();
  });

  it('rejects a team that does not exist', async () => {
    prisma.team.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'Sprint',
          teamId: 'missing-team',
          startDate: '2026-10-01',
          endDate: '2026-10-14',
        },
        user,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('moves a planned sprint to active', async () => {
    transaction.sprint.update.mockResolvedValue({ ...sprint, status: 'ACTIVE' });
    prisma.sprint.findUnique.mockResolvedValue({ ...sprint, status: 'ACTIVE' });

    const updated = await service.setStatus(sprint.id, 'ACTIVE');

    expect(updated.status).toBe('ACTIVE');
    expect(transaction.sprint.update).toHaveBeenCalledWith({
      where: { id: sprint.id },
      data: { status: 'ACTIVE' },
    });
  });

  it('moves an active sprint back to planned', async () => {
    transaction.sprint.update.mockResolvedValue({
      ...sprint,
      status: 'PLANNED',
    });
    prisma.sprint.findUnique.mockResolvedValue({ ...sprint, status: 'PLANNED' });

    await service.setStatus(sprint.id, 'PLANNED');

    expect(transaction.sprint.update).toHaveBeenCalledWith({
      where: { id: sprint.id },
      data: { status: 'PLANNED' },
    });
  });

  it('allows completed sprints to reopen', async () => {
    transaction.sprint.update.mockResolvedValue({
      ...sprint,
      status: 'ACTIVE',
    });
    prisma.sprint.findUnique.mockResolvedValue({ ...sprint, status: 'ACTIVE' });

    await service.setStatus(sprint.id, 'ACTIVE');

    expect(transaction.sprint.update).toHaveBeenCalledWith({
      where: { id: sprint.id },
      data: { status: 'ACTIVE' },
    });
  });

  it('completes a sprint without unfinished tasks', async () => {
    transaction.task.findMany.mockResolvedValueOnce([]);
    transaction.sprint.update.mockResolvedValue({
      ...sprint,
      status: 'COMPLETED',
    });
    prisma.sprint.findUnique.mockResolvedValue({
      ...sprint,
      status: 'COMPLETED',
    });

    const updated = await service.setStatus(sprint.id, 'COMPLETED');

    expect(updated.status).toBe('COMPLETED');
    expect(transaction.sprint.update).toHaveBeenCalledWith({
      where: { id: sprint.id },
      data: { status: 'COMPLETED' },
    });
  });

  it('rejects completion and identifies unfinished task keys', async () => {
    transaction.task.findMany.mockResolvedValueOnce([
      { taskKey: 'TASK-101' },
      { taskKey: 'TASK-104' },
    ]);

    await expect(
      service.setStatus(sprint.id, 'COMPLETED'),
    ).rejects.toThrow('TASK-101, TASK-104');

    expect(transaction.sprint.update).not.toHaveBeenCalled();
  });

  it('moves sprint tasks to the backlog before deleting the sprint', async () => {
    await service.delete(sprint.id);

    expect(transaction.task.updateMany).toHaveBeenCalledWith({
      where: { sprintId: sprint.id },
      data: { sprintId: null },
    });
    expect(transaction.sprint.delete).toHaveBeenCalledWith({
      where: { id: sprint.id },
    });
  });

  it('does not delete completed sprints before reopening', async () => {
    transaction.sprint.findUnique.mockResolvedValue({
      id: sprint.id,
      status: 'COMPLETED',
    });

    await expect(service.delete(sprint.id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(transaction.sprint.delete).not.toHaveBeenCalled();
  });

  it('returns not found when the requested sprint does not exist', async () => {
    prisma.sprint.findUnique.mockResolvedValue(null);

    await expect(service.get(sprint.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns completion progress for active sprint tasks', async () => {
    prisma.sprint.findUnique.mockResolvedValue({
      ...sprint,
      tasks: [
        { taskKey: 'TASK-101', status: 'DONE' },
        { taskKey: 'TASK-102', status: 'TODO' },
      ],
    });

    await expect(service.get(sprint.id)).resolves.toEqual(
      expect.objectContaining({
        taskProgress: {
          total: 2,
          done: 1,
          unfinishedTaskKeys: ['TASK-102'],
        },
      }),
    );
  });
});
