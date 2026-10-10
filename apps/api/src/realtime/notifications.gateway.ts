import {
  ConfigService,
} from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Socket, Server } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../auth/types/auth.types.js';
import {
  RealtimeNotificationsService,
} from './realtime-notifications.service.js';

type AuthenticatedSocketData = {
  user?: AuthenticatedUser;
  accessTokenExpiresAt?: number;
  expirationTimer?: NodeJS.Timeout;
};

type AuthenticatedSocket = Socket & { data: AuthenticatedSocketData };

@WebSocketGateway()
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly realtimeNotificationsService: RealtimeNotificationsService,
  ) {}

  afterInit(server: Server): void {
    this.server = server;
    this.realtimeNotificationsService.setServer(server);
    server.engine.opts.cors = {
      origin: this.getAllowedOrigins(),
      credentials: true,
    };
    server.use((socket, next) =>
      this.authenticateSocket(socket as AuthenticatedSocket, next),
    );
  }

  handleConnection(socket: AuthenticatedSocket): void {
    const expiresAt = socket.data.accessTokenExpiresAt;

    if (!expiresAt) {
      socket.disconnect(true);
      return;
    }

    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      socket.disconnect(true);
      return;
    }

    socket.data.expirationTimer = setTimeout(() => {
      socket.disconnect(true);
    }, delay);
    socket.data.expirationTimer.unref();
  }

  handleDisconnect(socket: AuthenticatedSocket): void {
    if (socket.data.expirationTimer) {
      clearTimeout(socket.data.expirationTimer);
      socket.data.expirationTimer = undefined;
    }
  }

  private async authenticateSocket(
    socket: AuthenticatedSocket,
    next: (error?: Error) => void,
  ): Promise<void> {
    try {
      const origin = socket.handshake.headers.origin;
      if (origin && !this.getAllowedOrigins().includes(origin)) {
        next(new Error('Origin not allowed'));
        return;
      }

      const token = this.extractHandshakeToken(socket);
      if (!token) {
        next(new Error('Unauthorized'));
        return;
      }

      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        { algorithms: ['HS256'] },
      );
      if (
        !payload.sub ||
        typeof payload.sub !== 'string' ||
        typeof payload.exp !== 'number' ||
        payload.exp * 1000 <= Date.now()
      ) {
        next(new Error('Unauthorized'));
        return;
      }

      const user = await this.authService.findActiveUserById(payload.sub);
      if (!user) {
        next(new Error('Unauthorized'));
        return;
      }

      socket.data.user = user;
      socket.data.accessTokenExpiresAt = payload.exp * 1000;
      await socket.join(this.realtimeNotificationsService.roomForUser(user.id));
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  }

  private extractHandshakeToken(socket: Socket): string | null {
    const handshakeAuth = socket.handshake.auth;
    if (
      !handshakeAuth ||
      typeof handshakeAuth !== 'object' ||
      Array.isArray(handshakeAuth)
    ) {
      return null;
    }

    const token = (handshakeAuth as { token?: unknown }).token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  private getAllowedOrigins(): string[] {
    const origins = (
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:5173'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (origins.length === 0 || origins.includes('*')) {
      throw new Error('FRONTEND_URL must contain an explicit origin allowlist');
    }

    return origins;
  }
}
