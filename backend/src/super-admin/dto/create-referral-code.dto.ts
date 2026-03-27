import { IsString, IsOptional, IsNumber, Min, Max, IsInt, IsPositive } from 'class-validator';

export class CreateReferralCodeDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  creditPct: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  maxUses?: number;
}
