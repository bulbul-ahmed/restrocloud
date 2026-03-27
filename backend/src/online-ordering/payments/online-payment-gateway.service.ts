import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class OnlinePaymentGatewayService {
  constructor(private prisma: PrismaService) {}

  /**
   * Initiate Stripe Checkout Session.
   * Uses real Stripe credentials if configured for the restaurant;
   * falls back to mock if no credentials or Stripe API fails.
   */
  async initiateStripe(
    amount: number,
    currency: string,
    orderId: string,
    restaurantId: string,
    successUrl: string,
    cancelUrl: string,
  ) {
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { restaurantId_gateway: { restaurantId, gateway: 'STRIPE' } },
    });

    if (config?.isActive && config.secretKey) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const StripeLib = require('stripe');
        const stripe = new StripeLib(config.secretKey);

        // Stripe expects amount in smallest currency unit (paise/cents).
        // BDT is a 2-decimal currency, so multiply by 100.
        const unitAmount = Math.round(amount * 100);

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [
            {
              price_data: {
                currency: currency.toLowerCase(),
                product_data: { name: `Order ${orderId.slice(-8).toUpperCase()}` },
                unit_amount: unitAmount,
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: { orderId },
        });

        return {
          type: 'stripe' as const,
          checkoutSessionId: session.id as string,
          checkoutUrl: session.url as string,
          amount,
          currency: currency.toLowerCase(),
          isMock: false,
        };
      } catch (err: any) {
        // Stripe API error — fall through to mock
        console.warn('[Stripe] Real checkout failed, using mock:', err?.message);
      }
    }

    // Mock fallback
    const piId = `pi_mock_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    return {
      type: 'stripe' as const,
      checkoutSessionId: piId,
      clientSecret: `${piId}_secret_mock`,
      publishableKey: 'pk_test_mock_restrocloud_51MockKey',
      checkoutUrl: `https://checkout.stripe.com/pay/mock#${piId}`,
      amount,
      currency: currency.toLowerCase(),
      isMock: true,
    };
  }

  /**
   * Retrieve and verify a Stripe Checkout Session.
   * Returns true if payment_status === 'paid'.
   */
  async verifyStripeSession(sessionId: string, restaurantId: string): Promise<boolean> {
    const config = await this.prisma.paymentGatewayConfig.findUnique({
      where: { restaurantId_gateway: { restaurantId, gateway: 'STRIPE' } },
    });

    if (!config?.isActive || !config.secretKey) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const StripeLib = require('stripe');
      const stripe = new StripeLib(config.secretKey);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session.payment_status === 'paid';
    } catch {
      return false;
    }
  }

  /**
   * Mock SSLCommerz session initiation.
   * In production: POST https://sandbox.sslcommerz.com/gwprocess/v4/api.php
   */
  initiateSSLCommerz(
    amount: number,
    currency: string,
    orderId: string,
    restaurantName: string,
  ) {
    const sessionKey = `SSLCZ_MOCK_${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 24)}`;
    return {
      type: 'sslcommerz' as const,
      sessionKey,
      redirectUrl: `https://sandbox.sslcommerz.com/gwprocess/v4/image.php?Q=pay&SESSIONKEY=${sessionKey}`,
      storeId: 'restrocloud_sandbox',
      amount,
      currency,
    };
  }

  /**
   * Mock bKash payment create.
   * In production: POST https://tokenized.sandbox.bka.sh/v1.2.0-beta/tokenized/checkout/create
   */
  initiateBkash(amount: number, currency: string, orderId: string) {
    const paymentID = `BKASH_MOCK_${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 20)}`;
    return {
      type: 'bkash' as const,
      paymentID,
      bkashURL: `https://sandbox.bkash.com/checkout?paymentID=${paymentID}`,
      merchantInvoiceNumber: `INV-${orderId.slice(-8).toUpperCase()}`,
      amount,
      currency,
    };
  }

  /** Generate a realistic mock gateway transaction ID for a confirmed payment */
  generateGatewayTxId(gateway: string): string {
    const rand = uuidv4().replace(/-/g, '').slice(0, 20).toUpperCase();
    const prefix: Record<string, string> = {
      stripe: 'ch',
      sslcommerz: 'SSL',
      bkash: 'BKP',
    };
    return `${prefix[gateway] ?? 'GW'}_MOCK_${rand}`;
  }
}
