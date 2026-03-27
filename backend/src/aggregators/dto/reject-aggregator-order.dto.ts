import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RejectAggregatorOrderDto {
  @ApiPropertyOptional({
    example: 'OUT_OF_STOCK',
    description: 'Platform-specific reason code (sent back to aggregator)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reasonCode?: string;

  @ApiPropertyOptional({ example: 'Item is currently out of stock' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reasonText?: string;
}
