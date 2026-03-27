import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AggregatorsService } from './aggregators.service';
import { AggregatorsController } from './aggregators.controller';
import { AggregatorsWebhookController } from './aggregators-webhook.controller';
import { AggregatorFactory } from './aggregator.factory';
import { FoodpandaAdapter } from './adapters/foodpanda.adapter';
import { PathaoAdapter } from './adapters/pathao.adapter';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  imports: [PrismaModule, RedisModule, RealtimeModule],
  // Webhook controller FIRST — public, no auth guard
  controllers: [AggregatorsWebhookController, AggregatorsController],
  providers: [
    AggregatorsService,
    AggregatorFactory,
    FoodpandaAdapter,
    PathaoAdapter,
    PlanGuard,
  ],
  exports: [AggregatorsService],
})
export class AggregatorsModule {}
