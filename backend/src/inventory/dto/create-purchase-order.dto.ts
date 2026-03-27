import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class POItemDto {
  @IsUUID()
  ingredientId: string;

  @IsPositive()
  orderedQty: number;

  @IsPositive()
  unitCost: number;
}

export class CreatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POItemDto)
  items: POItemDto[];
}
