import {
  IsString, IsEmail, IsOptional, IsNotEmpty, Length,
  IsEnum, IsInt, IsBoolean, Min, Max,
} from 'class-validator';
import { PlanTier } from '@prisma/client';

export class CreateRestaurantDto {
  // ─── Owner ────────────────────────────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  ownerFirstName: string;

  @IsString()
  @IsNotEmpty()
  ownerLastName: string;

  @IsEmail()
  ownerEmail: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  // ─── Restaurant ───────────────────────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  restaurantName: string;

  @IsString()
  @Length(2, 2)
  country: string;                // ISO 2-letter, e.g. "BD", "US"

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  restaurantPhone?: string;

  @IsOptional()
  @IsEmail()
  restaurantEmail?: string;

  // ─── Plan & Trial ─────────────────────────────────────────────────────────

  @IsEnum(PlanTier)
  plan: PlanTier;                 // defaults to STARTER in controller

  @IsInt()
  @Min(0)
  @Max(90)
  trialDays: number;              // 0 = no trial; default 14

  // ─── SA-only ──────────────────────────────────────────────────────────────

  @IsOptional()
  @IsString()
  internalNotes?: string;         // saved as first TenantNote

  @IsBoolean()
  sendWelcomeEmail: boolean;      // default true
}
