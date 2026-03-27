import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DeliveryService } from './delivery.service';
import { DeliveryPublicController } from './delivery-public.controller';
import { DeliveryController } from './delivery.controller';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  imports: [PrismaModule, RedisModule, RealtimeModule, NotificationsModule],
  // Public controller first — no guards
  controllers: [DeliveryPublicController, DeliveryController],
  providers: [DeliveryService, PlanGuard],
  exports: [DeliveryService],
})
export class DeliveryModule {}
