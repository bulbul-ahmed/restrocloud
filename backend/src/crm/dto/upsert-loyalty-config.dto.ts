import { IsBoolean, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpsertLoyaltyConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsPerSpend?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bronzeThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  silverThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  goldThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  platinumThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointsExpiryDays?: number;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
