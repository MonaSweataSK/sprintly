import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  SESSION_TTL_SECONDS,
} from './auth.constants.js';
import { AuthService } from './auth.service.js';
import { AuthOriginGuard } from './auth-origin.guard.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { AuthenticatedRequest } from './session-auth.guard.js';
import { SessionAuthGuard } from './session-auth.guard.js';

const accessCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/',
};

const refreshCookieOptions = {
  ...accessCookieOptions,
  maxAge: SESSION_TTL_SECONDS * 1000,
};

@ApiTags('auth')
@Controller('auth')
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a sign-in code for an approved email' })
  requestOtp(@Body() body: RequestOtpDto) {
    return this.authService.requestOtp(body.email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify a sign-in code and create a session' })
  async verifyOtp(
    @Body() body: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyOtp(body.email, body.code);
    this.setCookies(response, result.tokens);
    return { user: result.user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate the session refresh token' })
  async refresh(
    @Req() request: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) response: Response,
  ) {
    const tokens = await this.authService.refresh(
      request.cookies?.[REFRESH_COOKIE],
    );
    this.setCookies(response, tokens);
    return { refreshed: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke the current session and clear cookies' })
  async logout(
    @Req() request: Request & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      request.cookies?.[ACCESS_COOKIE],
      request.cookies?.[REFRESH_COOKIE],
    );
    response.clearCookie(ACCESS_COOKIE, accessCookieOptions);
    response.clearCookie(REFRESH_COOKIE, accessCookieOptions);
    return { loggedOut: true };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  @ApiCookieAuth(ACCESS_COOKIE)
  @ApiOperation({ summary: 'Get the current user and current database role' })
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user);
  }

  private setCookies(
    response: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...accessCookieOptions,
      maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookieOptions);
  }
}
