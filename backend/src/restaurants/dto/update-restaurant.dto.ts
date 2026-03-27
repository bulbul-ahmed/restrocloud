import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  Length,
  IsEnum,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';

export class UpdateRestaurantDto {
  @ApiPropertyOptional({ example: 'Spice Garden — Dhanmondi' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Horizontal wordmark / banner logo URL (for QR & online ordering headers)' })
  @IsOptional()
  @IsString()
  logoWordmarkUrl?: string;

  @ApiPropertyOptional({ example: '#ff6b35', description: 'Brand color hex code' })
  @IsOptional()
  @IsString()
  brandColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'BD' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({ example: 'Asia/Dhaka' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: 'en' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({ example: 'BDT' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: OrderType, isArray: true })
  @IsOptional()
  @IsEnum(OrderType, { each: true })
  orderTypes?: OrderType[];
}
