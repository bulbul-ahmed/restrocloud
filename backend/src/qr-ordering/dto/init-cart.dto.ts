import { IsOptional, IsString, MaxLength } from 'class-validator';

export class InitCartDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deviceId?: string;
}
