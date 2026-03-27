import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyCreditDto {
  @ApiProperty({ example: 500, description: 'Credit amount to add (positive) or deduct (negative)' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'Goodwill credit for downtime' })
  @IsOptional()
  @IsString()
  reason?: string;
}
