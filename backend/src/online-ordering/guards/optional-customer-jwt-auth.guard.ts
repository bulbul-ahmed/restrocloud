import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like CustomerJwtAuthGuard but does NOT throw on missing/invalid token.
 * Use this on routes that support both guest (cartToken) and customer (JWT) access.
 * The request.user will be null when no valid token is present.
 */
@Injectable()
export class OptionalCustomerJwtAuthGuard extends AuthGuard('customer-jwt') {
  handleRequest(_err: any, user: any) {
    // Swallow errors — return null user for unauthenticated requests
    return user ?? null;
  }
}
