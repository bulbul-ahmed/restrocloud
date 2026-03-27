import { IsEnum, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPaymentDto {
  @ApiProperty({ example: 'stripe' })
  @IsString()
  gatewayName: string;

  @ApiProperty({ description: 'Must match the gatewayTxId stored on the Payment record' })
  @IsString()
  gatewayTxId: string;

  @ApiProperty()
  @IsUUID()
  orderId: string;

  @ApiProperty({ enum: ['SUCCESS', 'FAILED', 'CANCELLED'] })
  @IsEnum(['SUCCESS', 'FAILED', 'CANCELLED'])
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
}
