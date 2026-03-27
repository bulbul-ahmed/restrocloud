import { Module } from '@nestjs/common';
import { QrOrderingController } from './qr-ordering.controller';
import { QrStaffController } from './qr-staff.controller';
import { QrOrderingService } from './qr-ordering.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersModule } from '../orders/orders.module';
import { MenuModule } from '../menu/menu.module';
import { TablesModule } from '../tables/tables.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    RealtimeModule,
    NotificationsModule,
    OrdersModule,
    MenuModule,
    TablesModule,
  ],
  controllers: [QrOrderingController, QrStaffController],
  providers: [QrOrderingService],
})
export class QrOrderingModule {}
