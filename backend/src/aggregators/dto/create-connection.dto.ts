import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class CreateConnectionDto {
  @ApiProperty({
    enum: ['foodpanda', 'pathao', 'shohoz', 'chaldal'],
    example: 'foodpanda',
    description: 'Aggregator platform identifier',
  })
  @IsString()
  platform: string;

  @ApiPropertyOptional({ example: 'Foodpanda BD' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ example: 'fp_live_xxxxxxxxxxxxxxxx' })
  @IsOptional()
  @IsString()
  apiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  apiSecret?: string;

  @ApiPropertyOptional({ description: 'HMAC secret to verify incoming order webhooks' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiPropertyOptional({ enum: CommissionType, default: CommissionType.PERCENTAGE })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @ApiPropertyOptional({
    description: 'Commission rate (%) for PERCENTAGE type, or fixed amount per order for FIXED type',
    default: 0,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  commissionValue?: number;

  @ApiPropertyOptional({
    description: 'Auto-accept incoming orders from this aggregator',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoAccept?: boolean;
}
