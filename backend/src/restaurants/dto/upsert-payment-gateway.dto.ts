import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertPaymentGatewayDto {
  @IsOptional() @IsString() apiKey?: string;
  @IsOptional() @IsString() secretKey?: string;
  @IsOptional() @IsString() webhookSecret?: string;
  @IsOptional() @IsBoolean() isLive?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
