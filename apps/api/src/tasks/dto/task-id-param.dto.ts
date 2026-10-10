import { IsUUID } from 'class-validator';

export class TaskIdParamDto {
  @IsUUID('4')
  id!: string;
}
