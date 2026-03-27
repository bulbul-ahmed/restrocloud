import { IsString, IsOptional, IsNumber, IsInt, IsBoolean, Min, Max, MinLength } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @MinLength(3)
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
