import { Injectable, Logger } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

// M0.5.3 — Event type definitions with payload schemas
export interface NewOrderEvent {
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  channel: string;
  tableId?: string | null;
  tableNumber?: string | null;
  items: Array<{ name: string; quantity: number }>;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface OrderStatusChangeEvent {
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  previousStatus: string;
  newStatus: string;
  changedAt: string;
  note?: string;
}

export interface ItemOutOfStockEvent {
  restaurantId: string;
  itemId: string;
  itemName: string;
  reportedAt: string;
}

export interface KitchenUpdateEvent {
  orderId: string;
  orderItemId: string;
  restaurantId: string;
  status: string;
  updatedAt: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(private gateway: RealtimeGateway) {}

  emitNewOrder(tenantId: string, restaurantId: string, payload: NewOrderEvent) {
    // tenant room — all authenticated dashboard staff (owner, manager, cashier, waiter)
    this.gateway.server
      .to(`tenant:${tenantId}`)
      .emit('new_order', payload);
    // restaurant room — KDS / restaurant-specific listeners
    this.gateway.server
      .to(`restaurant:${restaurantId}`)
      .emit('new_order', payload);
    // kitchen room — kitchen display screens
    this.gateway.server
      .to(`kitchen:${restaurantId}`)
      .emit('new_order', payload);
    this.logger.log(`new_order emitted for restaurant ${restaurantId} — Order #${payload.orderNumber}`);
  }

  emitOrderStatusChange(tenantId: string, restaurantId: string, payload: OrderStatusChangeEvent) {
    this.gateway.server
      .to(`tenant:${tenantId}`)
      .emit('order_status_change', payload);
    this.gateway.server
      .to(`restaurant:${restaurantId}`)
      .emit('order_status_change', payload);
    this.gateway.server
      .to(`kitchen:${restaurantId}`)
      .emit('order_status_change', payload);
    // Per-order room — customers/guests tracking their specific order
    this.gateway.server
      .to(`order:${payload.orderId}`)
      .emit('order_status_change', payload);
    this.logger.log(
      `order_status_change: #${payload.orderNumber} ${payload.previousStatus} → ${payload.newStatus}`,
    );
  }

  emitItemOutOfStock(tenantId: string, restaurantId: string, payload: ItemOutOfStockEvent) {
    this.gateway.server
      .to(`restaurant:${restaurantId}`)
      .emit('item_out_of_stock', payload);
    this.logger.log(`item_out_of_stock: ${payload.itemName} in restaurant ${restaurantId}`);
  }

  emitKitchenUpdate(restaurantId: string, payload: KitchenUpdateEvent) {
    this.gateway.server
      .to(`kitchen:${restaurantId}`)
      .emit('kitchen_update', payload);
  }

  emitToTenant(tenantId: string, event: string, payload: any) {
    this.gateway.server.to(`tenant:${tenantId}`).emit(event, payload);
  }

  /**
   * Returns true if at least one connected socket in the tenant room
   * has one of the specified roles attached to its JWT payload.
   */
  isStaffAvailable(tenantId: string, roles: string[]): boolean {
    const room = `tenant:${tenantId}`;
    const sids = this.gateway.server.sockets.adapter.rooms.get(room);
    if (!sids || sids.size === 0) return false;
    for (const sid of sids) {
      const socket = this.gateway.server.sockets.sockets.get(sid);
      if (socket && roles.includes((socket as any).user?.role)) return true;
    }
    return false;
  }

  emitToRestaurant(restaurantId: string, event: string, payload: any) {
    this.gateway.server.to(`restaurant:${restaurantId}`).emit(event, payload);
    this.logger.log(`${event} emitted to restaurant:${restaurantId}`);
  }
}
