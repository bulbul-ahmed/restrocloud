import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FlagTenantDto {
  @ApiPropertyOptional({ example: 'Suspicious high-volume refund activity' })
  @IsOptional()
  @IsString()
  reason?: string;
}
