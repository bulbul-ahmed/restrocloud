import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@prisma/client';

export class KioskModifierDto {
  @IsString() modifierId: string;
  @IsString() name: string;
  @IsNumber() priceAdjust: number;
}

export class KioskOrderItemDto {
  @ApiProperty() @IsString() itemId: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
  @ApiPropertyOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KioskModifierDto)
  @IsOptional()
  modifiers?: KioskModifierDto[];
}

export class PlaceKioskOrderDto {
  @ApiProperty({ enum: [OrderType.DINE_IN, OrderType.TAKEAWAY] })
  @IsEnum(OrderType)
  orderType: OrderType;

  @ApiProperty({ type: [KioskOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KioskOrderItemDto)
  items: KioskOrderItemDto[];

  @ApiPropertyOptional({ example: 'CASH' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guestName?: string;
}
