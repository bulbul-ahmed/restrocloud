import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsNumber,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';

export class DeliveryAddressDto {
  @ApiProperty({ example: '123 Mirpur Road' })
  @IsString()
  line1: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Mirpur' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lng?: number;
}

export class PlaceOnlineOrderDto {
  @ApiProperty({ description: 'Cart token from cart init/add-item responses' })
  @IsString()
  cartToken: string;

  @ApiProperty({ enum: ['DELIVERY', 'TAKEAWAY'] })
  @IsEnum([OrderType.DELIVERY, OrderType.TAKEAWAY])
  orderType: 'DELIVERY' | 'TAKEAWAY';

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  deliveryAddress?: DeliveryAddressDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Loyalty points to redeem as discount (1 point = 1 BDT). Requires customer JWT.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  redeemPoints?: number;

  @ApiPropertyOptional({ description: 'Guest name (required for guest checkout)' })
  @IsOptional()
  @IsString()
  guestName?: string;

  @ApiPropertyOptional({ description: 'Guest phone number' })
  @IsOptional()
  @IsString()
  guestPhone?: string;
}
