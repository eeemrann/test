import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from './database.service.js';

@Controller('health')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('database')
  async getDatabaseHealth(): Promise<{
    status: 'ok';
    database: 'connected';
  }> {
    try {
      await this.databaseService.checkConnection();

      return {
        status: 'ok',
        database: 'connected',
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'unavailable',
      });
    }
  }
}
