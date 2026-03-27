import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  IAggregatorAdapter,
  AggregatorMenuItem,
  IncomingAggregatorOrder,
} from '../interfaces/aggregator-adapter.interface';

/**
 * M17.2 / M17.3 / M17.4 — Foodpanda API adapter (mock).
 *
 * In production, HTTP calls would target:
 *   https://api.foodpanda.com/v3/vendors/{vendorId}/orders
 *   https://api.foodpanda.com/v3/orders/{orderId}/status
 *   https://api.foodpanda.com/v3/vendors/{vendorId}/menu
 *
 * All HTTP calls here are mocked to enable end-to-end testing without
 * real Foodpanda credentials, following the same pattern as M14 payment mocks.
 */
@Injectable()
export class FoodpandaAdapter implements IAggregatorAdapter {
  readonly platform = 'foodpanda';

  parseWebhookOrder(payload: any): IncomingAggregatorOrder {
    return {
      externalOrderId: payload.order_id ?? payload.orderId ?? payload.externalOrderId,
      platform: 'foodpanda',
      customerName: payload.customer?.name ?? payload.customerName ?? 'Foodpanda Customer',
      customerPhone: payload.customer?.phone ?? payload.customerPhone,
      deliveryAddress:
        payload.delivery?.address ?? payload.delivery_address ?? payload.deliveryAddress,
      items: (payload.items ?? []).map((item: any) => ({
        externalItemId: String(item.item_id ?? item.id ?? ''),
        name: item.name ?? item.item_name ?? 'Unknown item',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.unit_price ?? item.price ?? item.unitPrice ?? 0),
        notes: item.special_instructions ?? item.notes,
        modifiers: (item.toppings ?? item.modifiers ?? []).map((m: any) => ({
          name: m.name ?? 'Modifier',
          priceAdjustment: Number(m.price ?? m.price_adjustment ?? 0),
        })),
      })),
      subtotal: Number(payload.sub_total ?? payload.subtotal ?? 0),
      deliveryFee: Number(payload.delivery_fee ?? 0),
      totalAmount: Number(payload.total_amount ?? payload.total ?? 0),
      currency: payload.currency ?? 'BDT',
      notes: payload.special_instructions ?? payload.notes,
      estimatedReadyMinutes: payload.prep_time ?? payload.estimatedReadyMinutes,
    };
  }

  verifyWebhook(rawPayload: string, signature: string, secret: string): boolean {
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawPayload)
      .digest('hex')}`;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'utf8'),
        Buffer.from(signature, 'utf8'),
      );
    } catch {
      return false;
    }
  }

  async updateStatus(
    externalOrderId: string,
    status: string,
    _apiKey: string,
    _apiSecret?: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string }> {
    // MOCK: production → PUT https://api.foodpanda.com/v3/orders/{externalOrderId}/status
    const msg = `[MOCK] Foodpanda order ${externalOrderId} → ${status}${reason ? ` (${reason})` : ''}`;
    console.log(`[FoodpandaAdapter] ${msg}`);
    return { success: true, message: msg };
  }

  async syncMenu(
    items: AggregatorMenuItem[],
    _apiKey: string,
    _apiSecret?: string,
  ): Promise<{ synced: number; failed: number }> {
    // MOCK: production → PATCH https://api.foodpanda.com/v3/vendors/{vendorId}/menu
    console.log(`[FoodpandaAdapter] [MOCK] syncMenu — ${items.length} items`);
    const failed = items.filter((i) => !i.name || i.price < 0).length;
    return { synced: items.length - failed, failed };
  }

  async syncHours(
    _hours: any,
    _apiKey: string,
    _apiSecret?: string,
  ): Promise<{ success: boolean }> {
    // MOCK: production → PUT https://api.foodpanda.com/v3/vendors/{vendorId}/opening-hours
    console.log(`[FoodpandaAdapter] [MOCK] syncHours`);
    return { success: true };
  }

  async testConnection(
    apiKey: string,
    _apiSecret?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!apiKey || apiKey.trim().length < 8) {
      return { success: false, message: 'Foodpanda API key must be at least 8 characters' };
    }
    // MOCK: production → GET https://api.foodpanda.com/v3/vendors/me
    console.log(`[FoodpandaAdapter] [MOCK] testConnection — OK`);
    return { success: true, message: 'Foodpanda connection verified (mock)' };
  }
}
