import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly frontendOrigin: string;

  constructor(config: ConfigService) {
    this.frontendOrigin = new URL(
      config.getOrThrow<string>('FRONTEND_URL'),
    ).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.origin !== this.frontendOrigin) {
      throw new ForbiddenException('Requests must come from the configured application origin.');
    }
    return true;
  }
}
