import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';

@ApiTags('delivery-public')
@Controller('delivery')
export class DeliveryPublicController {
  constructor(private readonly svc: DeliveryService) {}

  // M18.9 — Public customer tracking (no auth)
  @Get('track/:deliveryId')
  @ApiOperation({ summary: 'Public delivery tracking (customer-facing, no auth) (M18.9)' })
  track(@Param('deliveryId') deliveryId: string) {
    return this.svc.trackDelivery(deliveryId);
  }
}
