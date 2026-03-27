import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateServiceChargeDto {
  @ApiProperty({
    example: 5,
    description: 'Service charge as percentage of subtotal (0 = disabled)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  serviceCharge: number;
}
