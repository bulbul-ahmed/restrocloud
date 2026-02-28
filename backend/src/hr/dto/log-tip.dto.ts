import { IsUUID, IsNumber, Min, IsIn, IsOptional, IsString, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class LogTipDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 150 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ enum: ['ORDER', 'CASH', 'MANUAL'] })
  @IsIn(['ORDER', 'CASH', 'MANUAL'])
  source: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsISO8601()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
