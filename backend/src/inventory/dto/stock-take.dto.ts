import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';

export class StockTakeItemDto {
  @IsUUID()
  ingredientId: string;

  @IsNumber()
  @Min(0)
  physicalCount: number;
}

export class StockTakeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTakeItemDto)
  counts: StockTakeItemDto[];
}
