import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Tenant-side role hierarchy — higher index = more access
const ROLE_HIERARCHY: UserRole[] = [
  UserRole.STAFF,
  UserRole.DRIVER,
  UserRole.KITCHEN,
  UserRole.WAITER,
  UserRole.CASHIER,
  UserRole.MANAGER,
  UserRole.OWNER,
];

// Super-admin tier roles that bypass all role checks
const SA_BYPASS_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.PLATFORM_OWNER];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('No user context');

    // SUPER_ADMIN and PLATFORM_OWNER bypass all role restrictions
    if ((SA_BYPASS_ROLES as string[]).includes(user.role)) return true;

    // For all other roles: exact match against required roles
    const exactMatch = (requiredRoles as string[]).includes(user.role);
    if (exactMatch) return true;

    // Fallback: hierarchy check for tenant-side roles
    const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role);
    const hasHierarchyRole = requiredRoles.some((role) => {
      const requiredIndex = ROLE_HIERARCHY.indexOf(role);
      return requiredIndex >= 0 && userRoleIndex >= requiredIndex;
    });

    if (!hasHierarchyRole) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}`,
      );
    }

    return true;
  }
}
