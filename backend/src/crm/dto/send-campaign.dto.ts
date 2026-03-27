import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SendCampaignDto {
  @IsString()
  name: string;

  @IsEnum(['EMAIL', 'SMS', 'PUSH'])
  channel: 'EMAIL' | 'SMS' | 'PUSH';

  @IsEnum(['ALL', 'NEW', 'REGULAR', 'VIP', 'DORMANT', 'AT_RISK'])
  segment: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body: string;
}
