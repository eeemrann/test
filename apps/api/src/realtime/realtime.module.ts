import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { RealtimeNotificationsService } from './realtime-notifications.service.js';

@Module({
  imports: [DatabaseModule, AuthorizationModule],
  providers: [RealtimeNotificationsService, NotificationsGateway],
  exports: [RealtimeNotificationsService],
})
export class RealtimeModule {}
