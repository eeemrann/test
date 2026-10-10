import { IsIn } from 'class-validator';
import { taskStatusEnum } from '../../database/schema.js';

export class UpdateTaskStatusDto {
  @IsIn([...taskStatusEnum.enumValues])
  status!: (typeof taskStatusEnum.enumValues)[number];
}
