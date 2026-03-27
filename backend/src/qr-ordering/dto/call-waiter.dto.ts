import { IsUUID, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CallWaiterDto {
  @ApiProperty()
  @IsUUID()
  guestToken: string;

  @ApiPropertyOptional({ example: 'We need extra napkins please' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;
}
