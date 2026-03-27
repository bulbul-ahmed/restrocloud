import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsInt, IsDateString, IsString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { OrderStatus, OrderType } from '@prisma/client';

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: OrderType })
  @IsOptional()
  @IsEnum(OrderType)
  channel?: OrderType;

  @ApiPropertyOptional({ example: '2026-02-27T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-02-27T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  // ─── M16.6 Enhanced filters ──────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Search by order number or customer name/phone', example: 'ORD-00001' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['pos', 'qr', 'online'], description: 'Filter by order source channel' })
  @IsOptional()
  @IsEnum(['pos', 'qr', 'online'])
  source?: 'pos' | 'qr' | 'online';

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;
}
