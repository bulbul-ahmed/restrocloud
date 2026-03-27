import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RedeemPointsDto {
  @ApiProperty({ description: 'Number of points to redeem (1 point = 1 BDT off)', example: 100 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  points: number;

  @ApiPropertyOptional({ description: 'Order UUID to link this redemption to' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ example: 'Redeemed for order ORD-00006' })
  @IsOptional()
  @IsString()
  description?: string;
}
