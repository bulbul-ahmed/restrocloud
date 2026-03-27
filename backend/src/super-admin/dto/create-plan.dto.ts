import { IsEnum, IsString, IsNumber, IsBoolean, IsOptional, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlanTier } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  tier: PlanTier;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceMonthly: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  priceAnnual: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: '-1 = unlimited', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(-1)
  maxLocations?: number;

  @ApiPropertyOptional({ description: '-1 = unlimited', default: -1 })
  @IsOptional()
  @IsNumber()
  @Min(-1)
  maxUsers?: number;

  @ApiPropertyOptional({ description: 'Feature flags JSON object', default: {} })
  @IsOptional()
  @IsObject()
  features?: Record<string, boolean>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
