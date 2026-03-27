import { IsString, IsBoolean, IsOptional, MinLength, Matches } from 'class-validator';

export class SetFeatureFlagDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9_]+$/, { message: 'key must be lowercase letters, digits, or underscores' })
  key: string;

  @IsBoolean()
  enabled: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
