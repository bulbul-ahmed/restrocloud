import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStampCardDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(1)
  stampsRequired: number;

  @IsString()
  rewardDesc: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rewardValue?: number;
}
