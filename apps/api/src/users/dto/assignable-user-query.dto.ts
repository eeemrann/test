import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';

export class AssignableUserQueryDto {
  @IsOptional()
  @IsIn(['create', 'reassign'])
  purpose?: 'create' | 'reassign';

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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(160)
  search?: string;
}
