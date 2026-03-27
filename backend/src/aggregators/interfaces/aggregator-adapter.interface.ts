// M17.1 — Aggregator abstraction layer

export interface AggregatorOrderItem {
  externalItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiers?: { name: string; priceAdjustment: number }[];
}

export interface IncomingAggregatorOrder {
  externalOrderId: string;
  platform: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: AggregatorOrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  currency: string;
  notes?: string;
  estimatedReadyMinutes?: number;
}

export interface AggregatorMenuItem {
  internalItemId: string;
  externalItemId?: string;
  name: string;
  price: number;
  isAvailable: boolean;
  categoryName?: string;
}

export interface IAggregatorAdapter {
  readonly platform: string;

  /** Parse raw webhook payload into a normalized order */
  parseWebhookOrder(rawPayload: any): IncomingAggregatorOrder;

  /** Verify HMAC webhook signature */
  verifyWebhook(rawPayload: string, signature: string, secret: string): boolean;

  /** Push order status to aggregator platform */
  updateStatus(
    externalOrderId: string,
    status: string,
    apiKey: string,
    apiSecret?: string,
    reason?: string,
  ): Promise<{ success: boolean; message: string }>;

  /** Push menu item availability + prices to aggregator */
  syncMenu(
    items: AggregatorMenuItem[],
    apiKey: string,
    apiSecret?: string,
  ): Promise<{ synced: number; failed: number }>;

  /** Push operating hours to aggregator */
  syncHours(
    hours: any,
    apiKey: string,
    apiSecret?: string,
  ): Promise<{ success: boolean }>;

  /** Validate API key against aggregator */
  testConnection(
    apiKey: string,
    apiSecret?: string,
  ): Promise<{ success: boolean; message: string }>;
}
