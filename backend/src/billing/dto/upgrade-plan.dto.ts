import { IsEnum } from 'class-validator';
import { PlanTier, BillingCycle } from '@prisma/client';

export class UpgradePlanDto {
  @IsEnum(PlanTier)
  plan: PlanTier;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;
}
