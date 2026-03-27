import { Module } from '@nestjs/common';
import { KbController } from './kb.controller';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [KbController],
})
export class KbModule {}
