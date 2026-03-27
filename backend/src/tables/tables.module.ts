import { Module } from '@nestjs/common';
import { TablesController } from './tables.controller';
import { FloorSectionsController } from './floor-sections.controller';
import { TablesService } from './tables.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [TablesController, FloorSectionsController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
