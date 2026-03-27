import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';
import { CrmCronService } from './crm-cron.service';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CrmController],
  providers: [CrmService, CrmCronService, PlanGuard],
  exports: [CrmService],
})
export class CrmModule {}
