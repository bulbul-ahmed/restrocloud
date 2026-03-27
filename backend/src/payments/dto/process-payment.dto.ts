import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class ProcessPaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiProperty({ description: 'Amount to pay (must not exceed order outstanding balance)', example: 693.75 })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({ description: 'Gateway name (stripe, bkash, sslcommerz)', example: 'bkash' })
  @IsOptional()
  @IsString()
  gatewayName?: string;

  @ApiPropertyOptional({ description: 'Gateway transaction ID for reconciliation', example: 'TXN123456' })
  @IsOptional()
  @IsString()
  gatewayTxId?: string;

  @ApiPropertyOptional({ description: 'Optional payment notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
