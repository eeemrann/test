import { IsUUID } from 'class-validator';

export class ReassignTaskDto {
  @IsUUID('4')
  assignedToId!: string;
}
