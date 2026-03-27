import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsExportService } from './analytics-export.service';
import { AnalyticsCronService } from './analytics-cron.service';
import { RedisModule } from '../common/redis/redis.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsExportService, AnalyticsCronService, PlanGuard],
})
export class AnalyticsModule {}
