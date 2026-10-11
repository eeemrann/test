import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
