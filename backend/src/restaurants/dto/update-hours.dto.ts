import {
  IsObject,
  IsOptional,
  ValidateNested,
  IsBoolean,
  IsString,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class DayHoursDto {
  @IsBoolean()
  closed: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'open must be HH:MM format' })
  open?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'close must be HH:MM format' })
  close?: string;
}

export class RegularHoursDto {
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) mon?: DayHoursDto;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) tue?: DayHoursDto;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) wed?: DayHoursDto;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) thu?: DayHoursDto;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) fri?: DayHoursDto;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) sat?: DayHoursDto;
  @IsOptional() @ValidateNested() @Type(() => DayHoursDto) sun?: DayHoursDto;
}

export class HolidayOverrideDto {
  @IsBoolean()
  closed: boolean;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  open?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  close?: string;
}

export class UpdateHoursDto {
  @ApiPropertyOptional({
    description: 'Regular weekly hours. Keys: mon|tue|wed|thu|fri|sat|sun',
    example: {
      mon: { open: '09:00', close: '22:00', closed: false },
      sun: { closed: true },
    },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RegularHoursDto)
  regularHours?: RegularHoursDto;

  @ApiPropertyOptional({
    description: 'Holiday overrides keyed by date (YYYY-MM-DD)',
    example: { '2026-12-25': { closed: true, note: 'Christmas' } },
  })
  @IsOptional()
  @IsObject()
  holidayOverrides?: Record<string, HolidayOverrideDto>;
}
