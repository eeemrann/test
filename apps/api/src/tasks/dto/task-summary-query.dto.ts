import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { taskPriorityEnum } from '../../database/schema.js';

export const TASK_SUMMARY_SCOPES = ['all', 'mine'] as const;
export type TaskSummaryScope = (typeof TASK_SUMMARY_SCOPES)[number];

export class TaskSummaryQueryDto {
  @IsOptional()
  @IsIn([...TASK_SUMMARY_SCOPES])
  scope?: TaskSummaryScope;

  @IsOptional()
  @IsIn([...taskPriorityEnum.enumValues])
  priority?: (typeof taskPriorityEnum.enumValues)[number];

  @IsOptional()
  @IsUUID('4')
  assignedToId?: string;

  @IsOptional()
  @IsUUID('4')
  createdById?: string;

  @IsOptional()
  @IsUUID('4')
  teamId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  deadlineFrom?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  deadlineTo?: string | null;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) {
      return true;
    }
    if (value === 'false' || value === false) {
      return false;
    }
    return value;
  })
  @IsBoolean()
  overdue?: boolean;
}
