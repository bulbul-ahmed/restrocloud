import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SavePaymentMethodDto {
  @ApiProperty({ example: 'bkash', description: 'Gateway: stripe | sslcommerz | bkash | cod' })
  @IsString()
  @IsNotEmpty()
  gateway: string;

  @ApiPropertyOptional({ example: 'bKash ****4567' })
  @IsOptional()
  @IsString()
  label?: string;
}
