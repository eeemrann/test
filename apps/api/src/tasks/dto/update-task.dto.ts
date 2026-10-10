import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { taskPriorityEnum } from '../../database/schema.js';

export class UpdateTaskDto {
  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  title?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn([...taskPriorityEnum.enumValues])
  priority?: (typeof taskPriorityEnum.enumValues)[number];

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  deadline?: string | null;
}
