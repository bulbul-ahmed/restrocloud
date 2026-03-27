import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AggregatorReportQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Start date (inclusive)' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'End date (inclusive)' })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}
