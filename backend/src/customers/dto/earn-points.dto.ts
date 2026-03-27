import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class EarnPointsDto {
  @ApiPropertyOptional({
    description: 'Order amount in BDT — points calculated as floor(amount / 10). Use this OR points.',
    example: 693.75,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Directly credit this many points (manual adjustment). Use this OR amount.',
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  points?: number;

  @ApiPropertyOptional({ description: 'Order UUID to link this earn transaction to' })
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @ApiPropertyOptional({ example: 'Points for order ORD-00005' })
  @IsOptional()
  @IsString()
  description?: string;
}
