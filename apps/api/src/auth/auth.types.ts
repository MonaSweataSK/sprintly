import type { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  sessionId: string;
}

export interface TokenPayload {
  sub: string;
  sid: string;
  typ: 'access' | 'refresh';
  jti?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
