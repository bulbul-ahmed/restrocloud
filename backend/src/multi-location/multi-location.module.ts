import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MultiLocationService } from './multi-location.service';
import { MultiLocationController } from './multi-location.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MultiLocationController],
  providers: [MultiLocationService],
  exports: [MultiLocationService],
})
export class MultiLocationModule {}
