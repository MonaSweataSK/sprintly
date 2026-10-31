import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { EmailService } from './email.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const OTP_SECRET = 'test-otp-secret-with-more-than-32-characters';
const JWT_SECRET = 'test-jwt-secret-with-more-than-32-characters';
const CODE = '042681';

const user = {
  id: 'user-id',
  name: 'Test Admin',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function challengeFor(code: string) {
  const id = 'challenge-id';
  return {
    id,
    userId: user.id,
    codeHash: createHmac('sha256', OTP_SECRET)
      .update(`${id}.${code}`)
      .digest('hex'),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    usedAt: null,
    attempts: 0,
    createdAt: new Date(),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: ReturnType<typeof vi.fn> };
    oTPChallenge: {
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    userSession: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let transaction: {
    oTPChallenge: {
      count: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    user: { findFirst: ReturnType<typeof vi.fn> };
    userSession: { create: ReturnType<typeof vi.fn> };
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn>; verifyAsync: ReturnType<typeof vi.fn> };
  let email: { assertConfigured: ReturnType<typeof vi.fn>; sendOtp: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    transaction = {
      oTPChallenge: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findFirst: vi.fn().mockResolvedValue(user) },
      userSession: { create: vi.fn().mockResolvedValue({}) },
    };
    prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(user) },
      oTPChallenge: {
        count: vi.fn().mockResolvedValue(0),
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      userSession: {
        create: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    jwt = {
      signAsync: vi
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: vi.fn(),
    };
    email = {
      assertConfigured: vi.fn(),
      sendOtp: vi.fn().mockResolvedValue(undefined),
    };
    const config = {
      getOrThrow: vi.fn((key: string) =>
        key === 'OTP_HASH_SECRET' ? OTP_SECRET : JWT_SECRET,
      ),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
      email as unknown as EmailService,
    );
  });

  it('stores only an HMAC hash and sends a six-digit OTP', async () => {
    const result = await service.requestOtp(user.email);

    expect(result.message).toContain('If this email is approved');
    expect(email.sendOtp).toHaveBeenCalledOnce();
    const [recipient, code] = email.sendOtp.mock.calls[0] as [string, string];
    expect(recipient).toBe(user.email);
    expect(code).toMatch(/^\d{6}$/);
    expect(transaction.oTPChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          codeHash: createHmac('sha256', OTP_SECRET)
            .update(
              `${transaction.oTPChallenge.create.mock.calls[0][0].data.id}.${code}`,
            )
            .digest('hex'),
        }),
      }),
    );
    expect(transaction.oTPChallenge.create.mock.calls[0][0].data.codeHash).not.toBe(
      code,
    );
  });

  it('returns the generic response without sending mail for an unknown email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.requestOtp('unknown@example.com');

    expect(result.message).toContain('If this email is approved');
    expect(email.sendOtp).not.toHaveBeenCalled();
    expect(transaction.oTPChallenge.count).not.toHaveBeenCalled();
  });

  it('enforces a per-user resend cooldown without disclosing account status', async () => {
    transaction.oTPChallenge.findFirst.mockResolvedValue({
      createdAt: new Date(),
    });

    const result = await service.requestOtp(user.email);

    expect(result.message).toContain('If this email is approved');
    expect(email.sendOtp).not.toHaveBeenCalled();
  });

  it('limits OTP requests per approved account to five per hour', async () => {
    transaction.oTPChallenge.count.mockResolvedValue(5);

    const result = await service.requestOtp(user.email);

    expect(result.message).toContain('If this email is approved');
    expect(transaction.oTPChallenge.create).not.toHaveBeenCalled();
    expect(email.sendOtp).not.toHaveBeenCalled();
  });

  it('increments attempts and rejects an incorrect OTP', async () => {
    prisma.oTPChallenge.findFirst.mockResolvedValue(challengeFor('123456'));

    await expect(service.verifyOtp(user.email, CODE)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.oTPChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      }),
    );
    expect(transaction.userSession.create).not.toHaveBeenCalled();
  });

  it('consumes a valid OTP once and creates a session with HttpOnly cookie tokens', async () => {
    prisma.oTPChallenge.findFirst.mockResolvedValue(challengeFor(CODE));

    const result = await service.verifyOtp(user.email, CODE);

    expect(result.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: UserRole.ADMIN,
    });
    expect(result.tokens).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ typ: 'access', sub: user.id }),
      expect.objectContaining({
        algorithm: 'HS256',
        issuer: 'sprintly-api',
        audience: 'sprintly-app',
        expiresIn: 15 * 60,
      }),
    );
    expect(transaction.oTPChallenge.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { usedAt: expect.any(Date) } }),
    );
    expect(transaction.userSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
          refreshTokenHash: expect.not.stringMatching(/^refresh-token$/),
        }),
      }),
    );
  });

  it('rejects a valid OTP if another request already consumed it', async () => {
    prisma.oTPChallenge.findFirst.mockResolvedValue(challengeFor(CODE));
    transaction.oTPChallenge.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.verifyOtp(user.email, CODE)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(transaction.userSession.create).not.toHaveBeenCalled();
  });
});
