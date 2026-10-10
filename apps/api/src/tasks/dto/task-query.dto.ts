import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
  IsISO8601,
  ValidateIf,
} from 'class-validator';
import {
  taskPriorityEnum,
  taskStatusEnum,
} from '../../database/schema.js';

export const TASK_SORT_FIELDS = ['createdAt', 'updatedAt', 'deadline'] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const TASK_SORT_ORDERS = ['asc', 'desc'] as const;
export type TaskSortOrder = (typeof TASK_SORT_ORDERS)[number];

export class TaskQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn([...taskStatusEnum.enumValues])
  status?: (typeof taskStatusEnum.enumValues)[number];

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

  @IsOptional()
  @IsIn([...TASK_SORT_FIELDS])
  sortBy?: TaskSortField;

  @IsOptional()
  @IsIn([...TASK_SORT_ORDERS])
  sortOrder?: TaskSortOrder;
}
