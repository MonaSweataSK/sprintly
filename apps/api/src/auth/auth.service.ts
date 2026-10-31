import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import type { OTPChallenge, User } from '@prisma/client';
import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  GENERIC_OTP_RESPONSE,
  OTP_EXPIRY_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS_PER_HOUR,
  OTP_RESEND_COOLDOWN_SECONDS,
  SESSION_TTL_SECONDS,
} from './auth.constants.js';
import type {
  AuthenticatedUser,
  AuthTokens,
  PublicUser,
  TokenPayload,
} from './auth.types.js';
import { EmailService } from './email.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const SESSION_MS = SESSION_TTL_SECONDS * 1000;
const OTP_MS = OTP_EXPIRY_SECONDS * 1000;
const EMAIL_REQUEST_WINDOW_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL = '30d';

@Injectable()
export class AuthService {
  private readonly otpHashSecret: string;
  private readonly jwtSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {
    this.otpHashSecret = this.config.getOrThrow<string>('OTP_HASH_SECRET');
    this.jwtSecret = this.config.getOrThrow<string>('JWT_SECRET');
  }

  async requestOtp(email: string): Promise<typeof GENERIC_OTP_RESPONSE> {
    this.email.assertConfigured();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user?.isActive) {
      return GENERIC_OTP_RESPONSE;
    }

    const challengeId = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const codeHash = this.hashOtp(challengeId, code);

    let challengeCreated: boolean;
    try {
      challengeCreated = await this.prisma.$transaction(
        async (transaction) => {
          const now = new Date();
          const [requestCount, mostRecent] = await Promise.all([
            transaction.oTPChallenge.count({
              where: {
                userId: user.id,
                createdAt: {
                  gte: new Date(now.getTime() - EMAIL_REQUEST_WINDOW_MS),
                },
              },
            }),
            transaction.oTPChallenge.findFirst({
              where: { userId: user.id },
              orderBy: { createdAt: 'desc' },
              select: { createdAt: true },
            }),
          ]);

          if (
            requestCount >= OTP_MAX_REQUESTS_PER_HOUR ||
            (mostRecent &&
              now.getTime() - mostRecent.createdAt.getTime() <
                OTP_RESEND_COOLDOWN_SECONDS * 1000)
          ) {
            return false;
          }

          await transaction.oTPChallenge.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: now },
          });
          await transaction.oTPChallenge.create({
            data: {
              id: challengeId,
              userId: user.id,
              codeHash,
              expiresAt: new Date(now.getTime() + OTP_MS),
            },
          });
          return true;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        return GENERIC_OTP_RESPONSE;
      }
      throw error;
    }

    if (!challengeCreated) {
      return GENERIC_OTP_RESPONSE;
    }

    try {
      await this.email.sendOtp(user.email, code);
    } catch (error) {
      await this.prisma.oTPChallenge.updateMany({
        where: { id: challengeId, usedAt: null },
        data: { usedAt: new Date() },
      });
      throw error;
    }

    return GENERIC_OTP_RESPONSE;
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ user: PublicUser; tokens: AuthTokens }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.isActive) {
      throw new UnauthorizedException('The code is invalid or has expired.');
    }

    const challenge = await this.prisma.oTPChallenge.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        attempts: { lt: OTP_MAX_ATTEMPTS },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!challenge || !this.matchesOtp(challenge, code)) {
      if (challenge) {
        await this.prisma.oTPChallenge.updateMany({
          where: {
            id: challenge.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
            attempts: { lt: OTP_MAX_ATTEMPTS },
          },
          data: { attempts: { increment: 1 } },
        });
      }
      throw new UnauthorizedException('The code is invalid or has expired.');
    }

    const now = new Date();
    const sessionId = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + SESSION_MS);
    const tokens = await this.createTokens(user.id, sessionId);
    const refreshTokenHash = this.hashToken(tokens.refreshToken);

    const consumed = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.oTPChallenge.updateMany({
        where: {
          id: challenge.id,
          usedAt: null,
          expiresAt: { gt: now },
          attempts: { lt: OTP_MAX_ATTEMPTS },
        },
        data: { usedAt: now },
      });
      if (result.count !== 1) {
        throw new UnauthorizedException('The code is invalid or has expired.');
      }

      const activeUser = await transaction.user.findFirst({
        where: { id: user.id, isActive: true },
      });
      if (!activeUser) {
        throw new UnauthorizedException('The code is invalid or has expired.');
      }

      await transaction.userSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash,
          lastActiveAt: now,
          expiresAt: sessionExpiresAt,
        },
      });

      return activeUser;
    });

    return {
      user: this.toPublicUser(consumed),
      tokens,
    };
  }

  async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    const payload = await this.verifyToken(refreshToken, 'refresh');
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    const now = new Date();

    if (
      !session ||
      session.userId !== payload.sub ||
      !session.user.isActive ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !this.safeEqual(this.hashToken(refreshToken), session.refreshTokenHash)
    ) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    const tokens = await this.createTokens(session.userId, session.id);
    const updated = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        userId: session.userId,
        refreshTokenHash: session.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        refreshTokenHash: this.hashToken(tokens.refreshToken),
        lastActiveAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MS),
      },
    });

    if (updated.count !== 1) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    return tokens;
  }

  async logout(
    accessToken: string | undefined,
    refreshToken: string | undefined,
  ): Promise<void> {
    const candidates = [refreshToken, accessToken].filter(
      (token): token is string => Boolean(token),
    );

    for (const token of candidates) {
      const expectedType = token === refreshToken ? 'refresh' : 'access';
      const payload = await this.verifyOptionalToken(token, expectedType);
      if (!payload) {
        continue;
      }

      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sid },
      });
      if (!session || session.userId !== payload.sub || session.revokedAt) {
        continue;
      }

      if (
        expectedType === 'refresh' &&
        !this.safeEqual(this.hashToken(token), session.refreshTokenHash)
      ) {
        continue;
      }

      await this.prisma.userSession.updateMany({
        where: { id: session.id, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return;
    }
  }

  async getCurrentUser(authenticatedUser: AuthenticatedUser): Promise<PublicUser> {
    return {
      id: authenticatedUser.id,
      email: authenticatedUser.email,
      name: authenticatedUser.name,
      role: authenticatedUser.role,
    };
  }

  async authenticateAccessToken(
    accessToken: string | undefined,
  ): Promise<AuthenticatedUser> {
    if (!accessToken) {
      throw new UnauthorizedException('Sign in to continue.');
    }

    const payload = await this.verifyToken(accessToken, 'access');
    const now = new Date();
    const session = await this.prisma.userSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });

    if (
      !session ||
      session.userId !== payload.sub ||
      !session.user.isActive ||
      session.revokedAt ||
      session.expiresAt <= now
    ) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    const touched = await this.prisma.userSession.updateMany({
      where: {
        id: session.id,
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        lastActiveAt: now,
        expiresAt: new Date(now.getTime() + SESSION_MS),
      },
    });
    if (touched.count !== 1) {
      throw new UnauthorizedException('Your session has expired. Sign in again.');
    }

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      sessionId: session.id,
    };
  }

  private async createTokens(
    userId: string,
    sessionId: string,
  ): Promise<AuthTokens> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, sid: sessionId, typ: 'access' } satisfies TokenPayload,
        {
          secret: this.jwtSecret,
          algorithm: 'HS256',
          issuer: 'sprintly-api',
          audience: 'sprintly-app',
          expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        },
      ),
      this.jwt.signAsync(
        {
          sub: userId,
          sid: sessionId,
          typ: 'refresh',
          jti: randomBytes(16).toString('hex'),
        } satisfies TokenPayload,
        {
          secret: this.jwtSecret,
          algorithm: 'HS256',
          issuer: 'sprintly-api',
          audience: 'sprintly-app',
          expiresIn: REFRESH_TOKEN_TTL,
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }

  private async verifyToken(
    token: string,
    type: TokenPayload['typ'],
  ): Promise<TokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.jwtSecret,
        algorithms: ['HS256'],
        issuer: 'sprintly-api',
        audience: 'sprintly-app',
      });
      if (
        payload.typ !== type ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string'
      ) {
        throw new UnauthorizedException('Invalid session token.');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
          error.name,
        )
      ) {
        throw new UnauthorizedException(
          'Your session has expired. Sign in again.',
        );
      }
      throw error;
    }
  }

  private async verifyOptionalToken(
    token: string,
    type: TokenPayload['typ'],
  ): Promise<TokenPayload | undefined> {
    try {
      return await this.verifyToken(token, type);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        return undefined;
      }
      throw error;
    }
  }

  private hashOtp(challengeId: string, code: string): string {
    return createHmac('sha256', this.otpHashSecret)
      .update(`${challengeId}.${code}`)
      .digest('hex');
  }

  private hashToken(token: string): string {
    return createHmac('sha256', this.otpHashSecret).update(token).digest('hex');
  }

  private matchesOtp(challenge: OTPChallenge, code: string): boolean {
    return this.safeEqual(this.hashOtp(challenge.id, code), challenge.codeHash);
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return (
      leftBuffer.length === rightBuffer.length &&
      leftBuffer.length > 0 &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
