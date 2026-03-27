import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { DisplayController } from './display.controller';
import { OrdersService } from './orders.service';
import { OrdersCronService } from './orders-cron.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { RedisModule } from '../common/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [PrismaModule, RealtimeModule, RedisModule, NotificationsModule, InventoryModule, PushModule],
  controllers: [OrdersController, DisplayController],
  providers: [OrdersService, OrdersCronService],
  exports: [OrdersService],
})
export class OrdersModule {}
