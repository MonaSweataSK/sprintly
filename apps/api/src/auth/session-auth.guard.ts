import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE } from './auth.constants.js';
import type { AuthenticatedUser } from './auth.types.js';
import { AuthService } from './auth.service.js';

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      AuthenticatedRequest & { cookies?: Record<string, string> }
    >();
    request.user = await this.authService.authenticateAccessToken(
      request.cookies?.[ACCESS_COOKIE],
    );
    return true;
  }
}
