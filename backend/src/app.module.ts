import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { EmailModule } from './common/email/email.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { TablesModule } from './tables/tables.module';
import { PaymentsModule } from './payments/payments.module';
import { CustomersModule } from './customers/customers.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { KdsModule } from './kds/kds.module';
import { QrOrderingModule } from './qr-ordering/qr-ordering.module';
import { OnlineOrderingModule } from './online-ordering/online-ordering.module';
import { AggregatorsModule } from './aggregators/aggregators.module';
import { DeliveryModule } from './delivery/delivery.module';
import { InventoryModule } from './inventory/inventory.module';
import { CrmModule } from './crm/crm.module';
import { HrModule } from './hr/hr.module';
import { PushModule } from './push/push.module';
import { MultiLocationModule } from './multi-location/multi-location.module';

@Module({
  imports: [
    // Config (M0.4.4)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting (M0.2.7)
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 20,
      },
      {
        name: 'medium',
        ttl: 10000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 60000,
        limit: 300,
      },
    ]),

    // Scheduler (M16.3 auto-accept cron)
    ScheduleModule.forRoot(),

    // Infrastructure
    PrismaModule,
    RedisModule,
    EmailModule,

    // Feature modules
    AuthModule,
    UsersModule,
    RestaurantsModule,
    MenuModule,
    OrdersModule,
    TablesModule,
    PaymentsModule,
    CustomersModule,
    RealtimeModule,
    HealthModule,
    AnalyticsModule,
    SuperAdminModule,
    NotificationsModule,
    KdsModule,
    QrOrderingModule,
    OnlineOrderingModule,
    AggregatorsModule,
    DeliveryModule,
    InventoryModule,
    CrmModule,
    HrModule,
    PushModule,
    MultiLocationModule,
  ],
})
export class AppModule {}
