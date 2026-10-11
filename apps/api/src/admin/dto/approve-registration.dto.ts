import { IsOptional, IsUUID } from 'class-validator';

export class ApproveRegistrationDto {
  @IsOptional()
  @IsUUID()
  teamId?: string | null;
}
