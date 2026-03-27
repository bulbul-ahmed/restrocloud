import { Module } from '@nestjs/common';
import { PaymentsController, OrderPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RealtimeModule, NotificationsModule],
  controllers: [PaymentsController, OrderPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
