import { IsUUID, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateShiftDto {
  @ApiProperty({ example: 'uuid-of-employee' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ example: '2026-03-01T09:00:00' })
  @IsISO8601()
  startsAt: string;

  @ApiProperty({ example: '2026-03-01T17:00:00' })
  @IsISO8601()
  endsAt: string;

  @ApiPropertyOptional({ example: 'Cover for Karim' })
  @IsOptional()
  @IsString()
  notes?: string;
}
