import { IsString, IsEnum, IsOptional, MinLength } from 'class-validator';
import { BroadcastSegment } from '@prisma/client';

export class SendBroadcastDto {
  @IsString()
  @MinLength(3)
  subject: string;

  @IsString()
  @MinLength(10)
  body: string;

  @IsOptional()
  @IsEnum(BroadcastSegment)
  segment?: BroadcastSegment;
}
