import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueRefundDto {
  @ApiProperty({ description: 'Refund amount — must not exceed remaining refundable balance', example: 200 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Reason for the refund', example: 'Customer returned item' })
  @IsOptional()
  @IsString()
  reason?: string;
}
