import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OnlineCartModifierDto } from './online-cart-modifier.dto';

export class OnlineCartAddItemDto {
  @ApiProperty({ description: 'Cart token from GET /online/:slug — keeps cart across requests' })
  @IsString()
  cartToken: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;

  @ApiPropertyOptional({ type: [OnlineCartModifierDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnlineCartModifierDto)
  modifiers?: OnlineCartModifierDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
