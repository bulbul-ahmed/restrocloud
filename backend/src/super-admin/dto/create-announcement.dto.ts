import { IsString, MinLength, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  @MinLength(10)
  body: string;

  @ApiPropertyOptional({ description: 'ISO datetime to schedule publication; null = publish immediately' })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
