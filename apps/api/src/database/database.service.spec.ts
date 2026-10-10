import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service.js';

describe('DatabaseService', () => {
  it('fails clearly when DATABASE_URL is missing', () => {
    const configService = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;

    expect(() => new DatabaseService(configService)).toThrow(
      'DATABASE_URL is required to initialize the database',
    );
  });

  it('executes the database connectivity check through Drizzle', async () => {
    const configService = {
      get: vi.fn().mockReturnValue('postgresql://localhost:5432/test'),
    } as unknown as ConfigService;
    const databaseService = new DatabaseService(configService);
    const execute = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });

    (databaseService as unknown as { db: { execute: typeof execute } }).db = {
      execute,
    };

    await expect(databaseService.checkConnection()).resolves.toBeUndefined();
    expect(execute).toHaveBeenCalledOnce();

    await databaseService.onModuleDestroy();
  });

  it('hides the underlying database error from callers', async () => {
    const configService = {
      get: vi.fn().mockReturnValue('postgresql://localhost:5432/test'),
    } as unknown as ConfigService;
    const databaseService = new DatabaseService(configService);
    const execute = vi.fn().mockRejectedValue(new Error('contains credentials'));

    (databaseService as unknown as { db: { execute: typeof execute } }).db = {
      execute,
    };

    await expect(databaseService.checkConnection()).rejects.toThrow(
      'Database connectivity check failed',
    );

    await databaseService.onModuleDestroy();
  });
});
