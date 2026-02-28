import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { OrdersModule } from '../orders/orders.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OnlineOrderingService } from './online-ordering.service';
import { OnlineOrderingController } from './online-ordering.controller';
import { OnlineOrderingAuthController } from './online-ordering-auth.controller';
import { OnlineCustomerController } from './online-customer.controller';
import { OnlineReviewsStaffController } from './online-reviews-staff.controller';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { OnlinePaymentsService } from './payments/online-payments.service';
import { OnlinePaymentGatewayService } from './payments/online-payment-gateway.service';
import { OnlineLoyaltyService } from './loyalty/online-loyalty.service';
// Webhook controller MUST be registered before the slug-parametric controllers
import { OnlinePaymentsWebhookController } from './payments/online-payments-webhook.controller';
import { OnlinePaymentsController } from './payments/online-payments.controller';
import { OnlinePaymentsStaffController } from './payments/online-payments-staff.controller';
import { PushModule } from '../push/push.module';

@Module({
  imports: [
    PrismaModule,
    PushModule,
    RedisModule,
    OrdersModule,
    RealtimeModule,
    NotificationsModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  // Order matters: static-path webhook controller FIRST, then slug-parametric
  controllers: [
    OnlinePaymentsWebhookController,
    OnlineReviewsStaffController,
    OnlineOrderingController,
    OnlineOrderingAuthController,
    OnlineCustomerController,
    OnlinePaymentsController,
    OnlinePaymentsStaffController,
  ],
  providers: [
    OnlineOrderingService,
    CustomerJwtStrategy,
    OnlinePaymentsService,
    OnlinePaymentGatewayService,
    OnlineLoyaltyService,
  ],
})
export class OnlineOrderingModule {}
