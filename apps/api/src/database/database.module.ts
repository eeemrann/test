import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseController } from './database.controller.js';
import { DatabaseService } from './database.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [DatabaseController],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
