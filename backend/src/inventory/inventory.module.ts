import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  imports: [PrismaModule, RedisModule, NotificationsModule],
  controllers: [InventoryController],
  providers: [InventoryService, PlanGuard],
  exports: [InventoryService],
})
export class InventoryModule {}
