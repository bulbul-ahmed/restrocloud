import { IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { UnitType } from '@prisma/client';

export class CreateIngredientDto {
  @IsString()
  name: string;

  @IsEnum(UnitType)
  unit: UnitType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPerUnit?: number;
}
