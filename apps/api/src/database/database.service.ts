import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  public readonly db: NodePgDatabase;

  constructor(private readonly configService: ConfigService) {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required to initialize the database');
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.db = drizzle(this.pool);
  }

  async checkConnection(): Promise<void> {
    try {
      await this.db.execute(sql`SELECT 1`);
    } catch {
      throw new Error('Database connectivity check failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
