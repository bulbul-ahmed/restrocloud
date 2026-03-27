import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlanTier } from '@prisma/client';

export class UpdatePlanDto {
  @ApiProperty({ enum: PlanTier })
  @IsEnum(PlanTier)
  plan: PlanTier;
}
