import { IsUUID } from 'class-validator';

export class NotificationIdParamDto {
  @IsUUID('4')
  id!: string;
}
