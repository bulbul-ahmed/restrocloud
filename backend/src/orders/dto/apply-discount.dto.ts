import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum DiscountType {
  FLAT = 'FLAT',       // fixed amount off
  PERCENT = 'PERCENT', // percentage off subtotal
}

export class ApplyDiscountDto {
  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENT })
  @IsEnum(DiscountType)
  type: DiscountType;

  @ApiProperty({ example: 10, description: 'Amount (flat) or percentage (0–100)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  value: number;

  @ApiPropertyOptional({ example: 'Staff discount' })
  @IsOptional()
  @IsString()
  reason?: string;
}
