import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { and, eq, gt, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import { DatabaseService } from '../database/database.service.js';
import {
  refreshSessions,
  users,
  type User,
} from '../database/schema.js';
import type {
  AuthenticatedUser,
  LoginResponse,
  LoginUser,
  SessionAuthenticationResult,
} from './types/auth.types.js';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid refresh token';
const REFRESH_COOKIE_NAME = 'office_refresh_token';
const REFRESH_COOKIE_PATH = '/auth';
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly refreshTokenTtlMs: number;
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly cookieSecure: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly jwtService: JwtService,
  ) {
    const ttlDays = Number(
      this.configService.get<string>('REFRESH_TOKEN_TTL_DAYS') ??
        DEFAULT_REFRESH_TOKEN_TTL_DAYS,
    );

    if (!Number.isInteger(ttlDays) || ttlDays <= 0) {
      throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive integer');
    }

    const configuredOrigins = (
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (configuredOrigins.length === 0 || configuredOrigins.includes('*')) {
      throw new Error('FRONTEND_URL must contain an explicit origin allowlist');
    }

    this.refreshTokenTtlMs = ttlDays * MILLISECONDS_PER_DAY;
    this.allowedOrigins = new Set(configuredOrigins);
    this.cookieSecure =
      this.configService.get<string>('NODE_ENV') === 'production';
  }

  async login(
    email: string,
    password: string,
  ): Promise<SessionAuthenticationResult> {
    let user: User | undefined;

    try {
      user = await this.findUserByEmail(email);
    } catch {
      throw new InternalServerErrorException(
        'Authentication service unavailable',
      );
    }

    if (!user || !user.isActive) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    let passwordMatches = false;

    try {
      passwordMatches = await bcrypt.compare(password, user.passwordHash);
    } catch {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    try {
      const accessToken = await this.jwtService.signAsync({ sub: user.id });
      const refreshToken = this.generateRefreshToken();

      await this.databaseService.db.insert(refreshSessions).values({
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.getRefreshTokenExpiry(),
      });

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: this.toLoginUser(user),
      };
    } catch {
      throw new InternalServerErrorException(
        'Authentication service unavailable',
      );
    }
  }

  async refresh(refreshToken: string | undefined): Promise<SessionAuthenticationResult> {
    if (!refreshToken) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    const presentedTokenHash = this.hashRefreshToken(refreshToken);
    const now = new Date();
    let rotatedSession: { user: User; refreshToken: string } | null;

    try {
      rotatedSession = await this.databaseService.db.transaction(async (tx) => {
        const [session] = await tx
          .select()
          .from(refreshSessions)
          .where(eq(refreshSessions.tokenHash, presentedTokenHash))
          .limit(1);

        if (
          !session ||
          session.revokedAt !== null ||
          session.expiresAt.getTime() <= now.getTime()
        ) {
          return null;
        }

        const [revokedSession] = await tx
          .update(refreshSessions)
          .set({ revokedAt: now })
          .where(
            and(
              eq(refreshSessions.id, session.id),
              isNull(refreshSessions.revokedAt),
              gt(refreshSessions.expiresAt, now),
            ),
          )
          .returning({ id: refreshSessions.id });

        if (!revokedSession) {
          return null;
        }

        const [user] = await tx
          .select()
          .from(users)
          .where(and(eq(users.id, session.userId), eq(users.isActive, true)))
          .limit(1);

        if (!user || !user.isActive) {
          return null;
        }

        const replacementToken = this.generateRefreshToken();

        await tx.insert(refreshSessions).values({
          userId: user.id,
          tokenHash: this.hashRefreshToken(replacementToken),
          expiresAt: this.getRefreshTokenExpiry(),
        });

        return { user, refreshToken: replacementToken };
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Authentication service unavailable',
      );
    }

    if (!rotatedSession) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE);
    }

    try {
      const accessToken = await this.jwtService.signAsync({
        sub: rotatedSession.user.id,
      });

      return {
        accessToken,
        refreshToken: rotatedSession.refreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
        user: this.toLoginUser(rotatedSession.user),
      };
    } catch {
      throw new InternalServerErrorException(
        'Authentication service unavailable',
      );
    }
  }

  async revokeRefreshToken(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      await this.databaseService.db
        .update(refreshSessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshSessions.tokenHash, this.hashRefreshToken(refreshToken)),
            isNull(refreshSessions.revokedAt),
          ),
        );
    } catch {
      throw new InternalServerErrorException(
        'Authentication service unavailable',
      );
    }
  }

  toPublicResponse(result: SessionAuthenticationResult): LoginResponse {
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    };
  }

  extractRefreshToken(request: Request): string | undefined {
    const cookieHeader = request.headers.cookie;

    if (!cookieHeader) {
      return undefined;
    }

    for (const cookie of cookieHeader.split(';')) {
      const separatorIndex = cookie.indexOf('=');

      if (separatorIndex < 0) {
        continue;
      }

      const name = cookie.slice(0, separatorIndex).trim();

      if (name !== REFRESH_COOKIE_NAME) {
        continue;
      }

      const value = cookie.slice(separatorIndex + 1).trim();

      try {
        return decodeURIComponent(value);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.getRefreshCookieBaseOptions(),
      maxAge: this.refreshTokenTtlMs,
    });
  }

  clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      ...this.getRefreshCookieBaseOptions(),
      maxAge: 0,
    });
  }

  assertAllowedOrigin(origin: string | undefined): void {
    if (origin && !this.allowedOrigins.has(origin)) {
      throw new ForbiddenException('Origin not allowed');
    }
  }

  async findActiveUserById(id: string): Promise<AuthenticatedUser | null> {
    const user = await this.findUserById(id);

    if (!user || !user.isActive) {
      return null;
    }

    return this.toAuthenticatedUser(user);
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken, 'utf8').digest('hex');
  }

  private getRefreshTokenExpiry(): Date {
    return new Date(Date.now() + this.refreshTokenTtlMs);
  }

  private getRefreshCookieBaseOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.cookieSecure,
      path: REFRESH_COOKIE_PATH,
    };
  }

  private async findUserByEmail(email: string): Promise<User | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    return user;
  }

  private async findUserById(id: string): Promise<User | undefined> {
    const [user] = await this.databaseService.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user;
  }

  private toLoginUser(user: User): LoginUser {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
    };
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      ...this.toLoginUser(user),
      isActive: user.isActive,
    };
  }
}
