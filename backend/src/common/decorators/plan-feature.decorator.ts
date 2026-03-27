import { SetMetadata } from '@nestjs/common';

export const PLAN_FEATURE_KEY = 'planFeature';

/**
 * Marks a controller or route as requiring a specific plan feature.
 * Used in conjunction with PlanGuard.
 *
 * @example
 *   @RequireFeature('aggregators')
 *   @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, PlanGuard)
 *   @Controller('restaurants/:id/aggregators')
 *   export class AggregatorsController {}
 */
export const RequireFeature = (feature: string) => SetMetadata(PLAN_FEATURE_KEY, feature);
