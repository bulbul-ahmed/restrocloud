import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OnlinePaymentGateway {
  STRIPE = 'STRIPE',
  SSLCOMMERZ = 'SSLCOMMERZ',
  BKASH = 'BKASH',
  COD = 'COD',
}

export class InitiatePaymentDto {
  @ApiProperty({ enum: OnlinePaymentGateway, example: 'STRIPE' })
  @IsEnum(OnlinePaymentGateway)
  method: OnlinePaymentGateway;

  @ApiPropertyOptional({ description: 'Required for guest (non-JWT) requests' })
  @IsOptional()
  @IsString()
  cartToken?: string;
}
