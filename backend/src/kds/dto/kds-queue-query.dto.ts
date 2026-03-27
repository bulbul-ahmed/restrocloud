import { IsEnum, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { KitchenStatus, OrderType } from '@prisma/client';

export class KdsQueueQueryDto {
  /** Filter to orders with at least one item in this kitchen status */
  @IsOptional()
  @IsEnum(KitchenStatus)
  status?: KitchenStatus;

  /** Filter by order channel (DINE_IN, TAKEAWAY, DELIVERY, etc.) */
  @IsOptional()
  @IsEnum(OrderType)
  channel?: OrderType;

  /** Station filter — show only items from this category (kitchen station) */
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Max orders to return (KDS shows many at once) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
