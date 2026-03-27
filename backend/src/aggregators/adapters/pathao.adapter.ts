import * as crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import {
  IAggregatorAdapter,
  AggregatorMenuItem,
  IncomingAggregatorOrder,
} from '../interfaces/aggregator-adapter.interface';

/**
 * M17.5 / M17.6 / M17.7 — Pathao Food API adapter (mock).
 *
 * In production, HTTP calls would target Pathao Food Partner API.
 * All HTTP calls here are mocked.
 */
@Injectable()
export class PathaoAdapter implements IAggregatorAdapter {
  readonly platform = 'pathao';

  parseWebhookOrder(payload: any): IncomingAggregatorOrder {
    return {
      externalOrderId: payload.order_id ?? payload.orderId ?? payload.merchant_order_id,
      platform: 'pathao',
      customerName:
        payload.recipient_name ?? payload.customer_name ?? payload.customerName ?? 'Pathao Customer',
      customerPhone: payload.recipient_phone ?? payload.customer_phone ?? payload.customerPhone,
      deliveryAddress:
        payload.recipient_address ?? payload.delivery_address ?? payload.deliveryAddress,
      items: (payload.order_items ?? payload.items ?? []).map((item: any) => ({
        externalItemId: String(item.item_id ?? item.id ?? ''),
        name: item.item_name ?? item.name ?? 'Unknown item',
        quantity: Number(item.quantity ?? 1),
        unitPrice: Number(item.item_price ?? item.unit_price ?? item.price ?? 0),
        notes: item.special_instruction ?? item.notes,
        modifiers: [],
      })),
      subtotal: Number(payload.merchant_order_amount ?? payload.subtotal ?? 0),
      deliveryFee: Number(payload.delivery_fee ?? 0),
      totalAmount: Number(payload.total_amount ?? payload.total ?? 0),
      currency: 'BDT',
      notes: payload.special_instruction ?? payload.notes,
      estimatedReadyMinutes: payload.prep_time,
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
    // MOCK: production → POST https://api.pathao.com/aladdin/api/v1/delivery-orders/{orderId}/status
    const msg = `[MOCK] Pathao order ${externalOrderId} → ${status}${reason ? ` (${reason})` : ''}`;
    console.log(`[PathaoAdapter] ${msg}`);
    return { success: true, message: msg };
  }

  async syncMenu(
    items: AggregatorMenuItem[],
    _apiKey: string,
    _apiSecret?: string,
  ): Promise<{ synced: number; failed: number }> {
    // MOCK: production → Pathao menu management API
    console.log(`[PathaoAdapter] [MOCK] syncMenu — ${items.length} items`);
    const failed = items.filter((i) => !i.name || i.price < 0).length;
    return { synced: items.length - failed, failed };
  }

  async syncHours(
    _hours: any,
    _apiKey: string,
    _apiSecret?: string,
  ): Promise<{ success: boolean }> {
    console.log(`[PathaoAdapter] [MOCK] syncHours`);
    return { success: true };
  }

  async testConnection(
    apiKey: string,
    _apiSecret?: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!apiKey || apiKey.trim().length < 8) {
      return { success: false, message: 'Pathao API key must be at least 8 characters' };
    }
    console.log(`[PathaoAdapter] [MOCK] testConnection — OK`);
    return { success: true, message: 'Pathao connection verified (mock)' };
  }
}
