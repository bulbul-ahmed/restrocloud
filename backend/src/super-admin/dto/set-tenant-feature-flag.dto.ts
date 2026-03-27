import { IsString, IsBoolean, MinLength, Matches } from 'class-validator';

export class SetTenantFeatureFlagDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[a-z0-9_]+$/, { message: 'key must be lowercase letters, digits, or underscores' })
  key: string;

  @IsBoolean()
  enabled: boolean;
}
