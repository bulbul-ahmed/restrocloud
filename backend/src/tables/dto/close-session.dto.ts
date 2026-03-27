import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CloseSessionDto {
  @ApiPropertyOptional({ example: 'Table cleaned and ready' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true, description: 'Force-close even if orders are incomplete. Pending/active orders will be cancelled. Requires MANAGER or OWNER role.' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
