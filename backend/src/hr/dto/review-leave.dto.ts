import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewLeaveDto {
  @ApiPropertyOptional({ example: 'Approved, please find a replacement' })
  @IsOptional()
  @IsString()
  managerNote?: string;
}
