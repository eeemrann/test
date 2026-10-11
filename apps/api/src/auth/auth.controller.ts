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
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import type { AuthenticatedUser } from './types/auth.types.js';

type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() request: Request) {
    return this.authService.register(
      registerDto.fullName,
      registerDto.email,
      registerDto.password,
      registerDto.confirmPassword,
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      loginDto.email,
      loginDto.password,
    );
    this.authService.setRefreshCookie(response, result.refreshToken);

    return this.authService.toPublicResponse(result);
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.authService.assertAllowedOrigin(request.headers.origin);
    const result = await this.authService.refresh(
      this.authService.extractRefreshToken(request),
    );
    this.authService.setRefreshCookie(response, result.refreshToken);

    return this.authService.toPublicResponse(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.authService.assertAllowedOrigin(request.headers.origin);

    // Logout revokes refresh capability; an already-issued access token remains
    // usable until its configured 15-minute expiration.
    try {
      await this.authService.revokeRefreshToken(
        this.authService.extractRefreshToken(request),
      );
    } finally {
      this.authService.clearRefreshCookie(response);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.authService.toPublicCurrentUser(request.user);
  }
}
