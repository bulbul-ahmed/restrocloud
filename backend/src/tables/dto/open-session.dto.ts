import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OpenSessionDto {
  @ApiPropertyOptional({ example: 3, description: 'Number of guests', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  guestCount?: number;

  @ApiPropertyOptional({ example: 'Birthday celebration' })
  @IsOptional()
  @IsString()
  notes?: string;
}
