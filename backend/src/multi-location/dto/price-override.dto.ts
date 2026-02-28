import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class SetPriceOverrideDto {
  @ApiProperty({ description: 'Restaurant (location) to apply override to' })
  @IsUUID()
  restaurantId: string;

  @ApiProperty({ description: 'Menu item ID' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ example: 299.0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;
}
