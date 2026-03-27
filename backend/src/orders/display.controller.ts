import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderStatus, OrderType as OrderChannel } from '@prisma/client';

/**
 * Public customer-facing display screen endpoint.
 * No auth required — shows READY takeaway orders for a restaurant.
 */
@ApiTags('display')
@Controller('display')
export class DisplayController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':restaurantId')
  @ApiOperation({ summary: 'Public display screen — READY takeaway orders (no auth)' })
  async getDisplayOrders(@Param('restaurantId') restaurantId: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, logoUrl: true },
    });

    if (!restaurant) {
      return { restaurant: null, ready: [], recentlyServed: [] };
    }

    // READY takeaway orders
    const ready = await this.prisma.order.findMany({
      where: {
        restaurantId,
        status: OrderStatus.READY,
        channel: { in: [OrderChannel.TAKEAWAY, OrderChannel.DINE_IN] },
      },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, orderNumber: true, updatedAt: true, guestName: true },
    });

    // SERVED/COMPLETED in the last 30 minutes (so customer knows theirs was called)
    const recentlyServed = await this.prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: [OrderStatus.SERVED, OrderStatus.COMPLETED] },
        channel: { in: [OrderChannel.TAKEAWAY, OrderChannel.DINE_IN] },
        updatedAt: { gte: thirtyMinutesAgo },
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { id: true, orderNumber: true, updatedAt: true },
    });

    return { restaurant, ready, recentlyServed };
  }
}
