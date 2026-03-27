import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CartModifierDto } from './cart-modifier.dto';

export class CartAddItemDto {
  @IsUUID()
  guestToken: string;

  @IsString()
  itemId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartModifierDto)
  modifiers?: CartModifierDto[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  notes?: string;
}
