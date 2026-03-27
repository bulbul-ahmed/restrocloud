import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@prisma/client';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @ApiPropertyOptional({
    enum: OrderType,
    default: OrderType.DINE_IN,
    description: 'Order channel',
  })
  @IsOptional()
  @IsEnum(OrderType)
  channel?: OrderType;

  @ApiPropertyOptional({ example: 'uuid-of-table' })
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-customer' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-table-session' })
  @IsOptional()
  @IsUUID()
  tableSessionId?: string;

  @ApiPropertyOptional({ example: 'Allergy to nuts' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 50, description: 'Tip amount in currency units' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  tipAmount?: number;

  @ApiPropertyOptional({ example: 20, description: 'Discount amount in currency units' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;

  @ApiProperty({ type: [CreateOrderItemDto], description: 'At least one item required' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
