import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_FEATURE_KEY } from '../decorators/plan-feature.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const SA_BYPASS_ROLES = ['SUPER_ADMIN', 'PLATFORM_OWNER', 'FINANCE_ADMIN', 'SUPPORT_MANAGER', 'SUPPORT_AGENT', 'ENGINEERING_ADMIN'];
const PLAN_FEATURES_TTL = 300; // 5 min

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(PLAN_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No feature requirement on this route — pass through
    if (!feature) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // No user yet (JWT guard handles auth errors) — let through
    if (!user) return true;

    // Super admin roles bypass plan checks
    if ((SA_BYPASS_ROLES as string[]).includes(user.role)) return true;

    const tenantId: string | undefined = user.tenantId ?? req.tenantId;
    if (!tenantId) throw new ForbiddenException('No tenant context');

    const features = await this.resolvePlanFeatures(tenantId);

    if (features === null) {
      // No plan config found — fail open (safety: don't block if plan table is empty)
      return true;
    }

    if (!features[feature]) {
      throw new ForbiddenException(
        `Your current plan does not include the '${feature}' feature. Please upgrade to access this functionality.`,
      );
    }

    return true;
  }

  // Canonical feature flags per tier (additive — each tier includes all tiers below it)
  private static readonly TIER_FEATURES: Record<string, Record<string, boolean>> = {
    STARTER:    { analytics: false, aggregators: false, multiLocation: false, delivery: false, inventory: false, crm: false },
    GROWTH:     { analytics: true,  aggregators: false, multiLocation: false, delivery: false, inventory: true,  crm: true  },
    PRO:        { analytics: true,  aggregators: true,  multiLocation: true,  delivery: true,  inventory: true,  crm: true  },
    ENTERPRISE: { analytics: true,  aggregators: true,  multiLocation: true,  delivery: true,  inventory: true,  crm: true  },
  };

  private async resolvePlanFeatures(tenantId: string): Promise<Record<string, boolean> | null> {
    const cacheKey = `plan:features:${tenantId}`;

    const cached = await this.redis.getJson<Record<string, boolean>>(cacheKey);
    if (cached) return cached;

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true, trialEndsAt: true },
    });
    if (!tenant) return null;

    // During active trial, grant PRO-level features regardless of current plan
    const isOnTrial = tenant.trialEndsAt !== null && tenant.trialEndsAt > new Date();
    const effectiveTier = isOnTrial ? 'PRO' : tenant.plan;

    const features = PlanGuard.TIER_FEATURES[effectiveTier] ?? PlanGuard.TIER_FEATURES['STARTER'];
    await this.redis.setJson(cacheKey, features, PLAN_FEATURES_TTL);
    return features;
  }
}
