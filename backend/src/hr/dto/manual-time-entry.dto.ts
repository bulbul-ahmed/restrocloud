import { IsUUID, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ManualTimeEntryDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: '2026-03-01T09:00:00' })
  @IsISO8601()
  clockIn: string;

  @ApiProperty({ example: '2026-03-01T17:00:00' })
  @IsISO8601()
  clockOut: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
