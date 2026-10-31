import { UserRole } from '@prisma/client';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';

function contextFor(role: UserRole): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows only the role declared for the route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
    expect(guard.canActivate(contextFor(UserRole.USER))).toBe(false);
  });

  it('allows routes without a role restriction', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.USER))).toBe(true);
  });
});
