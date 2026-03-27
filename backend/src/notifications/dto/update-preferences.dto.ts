import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { NotificationType } from '@prisma/client';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/; // HH:MM 24h

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsEnum(NotificationType, { each: true })
  mutedTypes?: NotificationType[];

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'quietHoursStart must be HH:MM format' })
  quietHoursStart?: string;

  @IsOptional()
  @IsString()
  @Matches(TIME_REGEX, { message: 'quietHoursEnd must be HH:MM format' })
  quietHoursEnd?: string;
}
