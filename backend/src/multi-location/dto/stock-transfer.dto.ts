import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsNumber, Min, IsOptional, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStockTransferDto {
  @ApiProperty()
  @IsUUID()
  fromRestaurantId: string;

  @ApiProperty()
  @IsUUID()
  toRestaurantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ingredientId: string;

  @ApiProperty({ example: 5.0 })
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveTransferDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
