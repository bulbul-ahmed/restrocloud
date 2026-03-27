import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CustomerJwtPayload {
  sub: string;         // customerId
  restaurantId: string;
  tenantId: string;
  email: string;
  type: 'customer';
}

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: CustomerJwtPayload) {
    if (payload.type !== 'customer') {
      throw new UnauthorizedException('Invalid token type');
    }
    const customer = await this.prisma.customer.findUnique({
      where: { id: payload.sub },
      select: { id: true, restaurantId: true, tenantId: true, email: true, isBlacklisted: true },
    });
    if (!customer || customer.isBlacklisted) {
      throw new UnauthorizedException('Customer not found or blocked');
    }
    return {
      customerId: customer.id,
      restaurantId: customer.restaurantId,
      tenantId: customer.tenantId,
      email: customer.email,
    };
  }
}
