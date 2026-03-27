import { IsNumber, Min, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDeliverySettingsDto {
  @ApiPropertyOptional({ example: 60, description: 'Flat delivery fee in local currency (0 = free)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  deliveryFee?: number;

  @ApiPropertyOptional({ example: 300, description: 'Minimum order amount required for delivery (0 = no minimum)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumOrderAmount?: number;
}
