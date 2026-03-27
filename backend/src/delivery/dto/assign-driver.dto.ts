import { IsUUID, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignDriverDto {
  @ApiProperty()
  @IsUUID()
  driverId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  estimatedAt?: string;
}
