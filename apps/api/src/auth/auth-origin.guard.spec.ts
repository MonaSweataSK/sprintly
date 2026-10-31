import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthOriginGuard } from './auth-origin.guard.js';

function contextFor(origin?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { origin } }),
    }),
  } as unknown as ExecutionContext;
}

describe('AuthOriginGuard', () => {
  const config = {
    getOrThrow: vi.fn().mockReturnValue('http://localhost:5173'),
  } as unknown as ConfigService;
  const guard = new AuthOriginGuard(config);

  it('allows the configured frontend origin', () => {
    expect(guard.canActivate(contextFor('http://localhost:5173'))).toBe(true);
  });

  it('rejects missing and untrusted origins', () => {
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor('https://untrusted.example'))).toThrow(
      ForbiddenException,
    );
  });
});
