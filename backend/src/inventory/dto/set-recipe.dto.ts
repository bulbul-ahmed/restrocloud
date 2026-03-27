import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsPositive, IsUUID, ValidateNested } from 'class-validator';
import { UnitType } from '@prisma/client';

export class RecipeItemDto {
  @IsUUID()
  ingredientId: string;

  @IsPositive()
  quantity: number;

  @IsEnum(UnitType)
  unit: UnitType;
}

export class SetRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeItemDto)
  items: RecipeItemDto[];
}
