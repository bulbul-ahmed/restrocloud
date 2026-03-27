import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MultiLocationService } from './multi-location.service';
import { MultiLocationController } from './multi-location.controller';
import { PlanGuard } from '../common/guards/plan.guard';

@Module({
  imports: [PrismaModule],
  controllers: [MultiLocationController],
  providers: [MultiLocationService, PlanGuard],
  exports: [MultiLocationService],
})
export class MultiLocationModule {}
