import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '@prisma/client';

export class LeaveRequestDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  type: LeaveType;

  @ApiProperty({ example: '2026-03-10' })
  @IsISO8601()
  startDate: string;

  @ApiProperty({ example: '2026-03-12' })
  @IsISO8601()
  endDate: string;

  @ApiPropertyOptional({ example: 'Family emergency' })
  @IsOptional()
  @IsString()
  reason?: string;
}
