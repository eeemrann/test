import { NotificationsGateway } from './notifications.gateway.js';

const USER_ID = '33333333-3333-4333-8333-333333333333';
const EXPIRING_USER = {
  id: USER_ID,
  fullName: 'Employee User',
  email: 'employee@office.local',
  role: 'EMPLOYEE' as const,
  teamId: null,
  isActive: true,
};

function makeGateway() {
  const jwtService = { verifyAsync: vi.fn() };
  const authService = { findActiveUserById: vi.fn() };
  const configService = {
    get: vi.fn().mockReturnValue('http://localhost:5173'),
  };
  const realtimeService = {
    setServer: vi.fn(),
    roomForUser: vi.fn().mockImplementation((id: string) => `user:${id}`),
  };
  const gateway = new NotificationsGateway(
    jwtService as never,
    authService as never,
    configService as never,
    realtimeService as never,
  );
  const middlewareHandlers: Array<(
    socket: unknown,
    next: (error?: Error) => void,
  ) => void | Promise<void>> = [];
  const server = {
    engine: { opts: {} },
    use: vi.fn((handler) => middlewareHandlers.push(handler)),
  };
  gateway.afterInit(server as never);

  return {
    gateway,
    jwtService,
    authService,
    realtimeService,
    middleware: middlewareHandlers[0]!,
  };
}

function socket(overrides: Record<string, unknown> = {}) {
  return {
    handshake: {
      headers: { origin: 'http://localhost:5173' },
      auth: { token: 'access-token' },
    },
    data: {},
    join: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    ...overrides,
  };
}

describe('NotificationsGateway', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('authenticates a valid handshake and joins only the verified user room', async () => {
    const { middleware, jwtService, authService } = makeGateway();
    jwtService.verifyAsync.mockResolvedValue({
      sub: USER_ID,
      exp: Math.floor(Date.now() / 1000) + 900,
      role: 'ADMIN',
    });
    authService.findActiveUserById.mockResolvedValue(EXPIRING_USER);
    const client = socket();
    const next = vi.fn();

    await middleware(client, next);

    expect(next).toHaveBeenCalledWith();
    expect(client.data.user).toEqual(EXPIRING_USER);
    expect(client.join).toHaveBeenCalledWith(`user:${USER_ID}`);
    expect(jwtService.verifyAsync).toHaveBeenCalledWith(
      'access-token',
      { algorithms: ['HS256'] },
    );
  });

  it.each([
    ['missing token', { missing: true }, null],
    ['invalid token', { verifyError: new Error('invalid') }, undefined],
    ['expired token', { payload: { sub: USER_ID, exp: 1 } }, EXPIRING_USER],
    ['inactive user', {
      payload: { sub: USER_ID, exp: Math.floor(Date.now() / 1000) + 900 },
      user: null,
    }, null],
  ])('rejects %s handshakes', async (_, options, expectedUser) => {
    const { middleware, jwtService, authService } = makeGateway();
    const config = options as {
      verifyError?: Error;
      payload?: object;
      user?: typeof EXPIRING_USER | null;
      missing?: boolean;
    };
    if (config.verifyError) {
      jwtService.verifyAsync.mockRejectedValue(config.verifyError);
    } else {
      jwtService.verifyAsync.mockResolvedValue(
        config.payload ?? { sub: USER_ID, exp: 1 },
      );
    }
    authService.findActiveUserById.mockResolvedValue(
      config.user === undefined ? expectedUser : config.user,
    );
    const client = socket({
      handshake: {
        headers: { origin: 'http://localhost:5173' },
        auth: config.missing ? {} : { token: 'access-token' },
      },
    });
    const next = vi.fn();

    await middleware(client, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(client.join).not.toHaveBeenCalled();
  });

  it('rejects an untrusted origin before authentication', async () => {
    const { middleware, jwtService } = makeGateway();
    const client = socket({
      handshake: {
        headers: { origin: 'https://evil.example' },
        auth: { token: 'access-token' },
      },
    });
    const next = vi.fn();

    await middleware(client, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('disconnects an established socket when its access token expires', () => {
    vi.useFakeTimers();
    const { gateway } = makeGateway();
    const client = socket({
      data: { accessTokenExpiresAt: Date.now() + 1000 },
    });

    gateway.handleConnection(client as never);
    vi.advanceTimersByTime(1000);

    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('clears expiration timers during disconnect', () => {
    const { gateway } = makeGateway();
    const timer = setTimeout(() => undefined, 10000);
    const client = socket({ data: { expirationTimer: timer } });
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    gateway.handleDisconnect(client as never);

    expect(clearTimeoutSpy).toHaveBeenCalledWith(timer);
  });
});
