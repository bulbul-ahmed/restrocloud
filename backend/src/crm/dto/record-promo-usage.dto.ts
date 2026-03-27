import { IsOptional, IsString, IsUUID } from 'class-validator';

export class RecordPromoUsageDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;
}
