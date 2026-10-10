import { ServiceUnavailableException } from '@nestjs/common';
import { DatabaseController } from './database.controller.js';
import { DatabaseService } from './database.service.js';

describe('DatabaseController', () => {
  it('returns a connected response when the database check succeeds', async () => {
    const checkConnection = vi.fn().mockResolvedValue(undefined);
    const databaseService = {
      checkConnection,
    } as unknown as DatabaseService;
    const controller = new DatabaseController(databaseService);

    await expect(controller.getDatabaseHealth()).resolves.toEqual({
      status: 'ok',
      database: 'connected',
    });
    expect(checkConnection).toHaveBeenCalledOnce();
  });

  it('returns a safe 503 exception when the database check fails', async () => {
    const checkConnection = vi
      .fn()
      .mockRejectedValue(new Error('internal connection failure'));
    const databaseService = {
      checkConnection,
    } as unknown as DatabaseService;
    const controller = new DatabaseController(databaseService);

    const error = await controller
      .getDatabaseHealth()
      .catch((caughtError: unknown) => caughtError);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      status: 'error',
      database: 'unavailable',
    });
    expect(checkConnection).toHaveBeenCalledOnce();
  });
});
