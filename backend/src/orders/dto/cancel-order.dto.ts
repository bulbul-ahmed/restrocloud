import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelOrderDto {
  @ApiPropertyOptional({ example: 'Customer changed their mind' })
  @IsOptional()
  @IsString()
  reason?: string;
}
