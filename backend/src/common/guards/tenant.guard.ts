import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * M0.3.4 — Tenant isolation middleware.
 * Ensures every authenticated request is scoped to the user's tenantId.
 * Attaches tenantId to request.tenantId for downstream use.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return true; // JWT guard handles this

    // Super admin can access any tenant (via header)
    if (user.role === 'SUPER_ADMIN') {
      const headerTenantId = request.headers['x-tenant-id'];
      request.tenantId = headerTenantId || user.tenantId;
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('No tenant context associated with this user');
    }

    request.tenantId = user.tenantId;
    return true;
  }
}
