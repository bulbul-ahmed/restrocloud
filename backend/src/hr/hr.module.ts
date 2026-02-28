import { Module } from '@nestjs/common';
import { HrService } from './hr.service';
import { HrCronService } from './hr-cron.service';
import { HrController } from './hr.controller';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [HrController],
  providers: [HrService, HrCronService],
  exports: [HrService],
})
export class HrModule {}
