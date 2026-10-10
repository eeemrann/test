import { Transform } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { taskPriorityEnum } from '../../database/schema.js';

export class CreateTaskDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @IsUUID('4')
  assignedToId!: string;

  @IsOptional()
  @IsIn([...taskPriorityEnum.enumValues])
  priority?: (typeof taskPriorityEnum.enumValues)[number];

  @IsOptional()
  @IsISO8601({ strict: true })
  deadline?: string | null;
}
