import { IsUUID, IsOptional, IsInt, Min, Max, IsNumber, IsString, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceQrOrderDto {
  @IsUUID()
  guestToken: string;

  @IsUUID()
  tableId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guestCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tipAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ enum: ['pay_now', 'pay_later'], default: 'pay_later' })
  @IsOptional()
  @IsString()
  @IsIn(['pay_now', 'pay_later'])
  paymentPreference?: 'pay_now' | 'pay_later';
}
