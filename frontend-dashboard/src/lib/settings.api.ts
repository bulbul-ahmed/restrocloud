import { api } from './api'
import type {
  RestaurantSettings,
  OperatingHours,
  TipOptions,
  ReceiptConfig,
  AutoAcceptConfig,
  AutoAcceptTimerConfig,
  OrderType,
  PaymentGatewayConfig,
} from '@/types/settings.types'

interface Envelope<T> { data: T }

const base = (id: string) => `/restaurants/${id}`

export const settingsApi = {
  get: (id: string): Promise<RestaurantSettings> =>
    api.get<Envelope<RestaurantSettings>>(base(id)).then((r) => r.data.data),

  updateProfile: (
    id: string,
    dto: Partial<{
      name: string
      description: string
      logoUrl: string
      phone: string
      email: string
      website: string
      address: string
      city: string
      country: string
      timezone: string
      locale: string
      currency: string
    }>,
  ): Promise<RestaurantSettings> =>
    api.patch<Envelope<RestaurantSettings>>(base(id), dto).then((r) => r.data.data),

  updateHours: (id: string, dto: OperatingHours): Promise<RestaurantSettings> =>
    api.patch<Envelope<RestaurantSettings>>(`${base(id)}/hours`, dto).then((r) => r.data.data),

  updateTax: (
    id: string,
    dto: { taxRate?: number; taxInclusive?: boolean },
  ): Promise<RestaurantSettings> =>
    api.patch<Envelope<RestaurantSettings>>(`${base(id)}/tax`, dto).then((r) => r.data.data),

  updateServiceCharge: (id: string, serviceCharge: number): Promise<RestaurantSettings> =>
    api
      .patch<Envelope<RestaurantSettings>>(`${base(id)}/service-charge`, { serviceCharge })
      .then((r) => r.data.data),

  updateDeliverySettings: (
    id: string,
    dto: { deliveryFee?: number; minimumOrderAmount?: number },
  ): Promise<{ deliveryFee: string | null; minimumOrderAmount: string | null }> =>
    api
      .patch<Envelope<{ deliveryFee: string | null; minimumOrderAmount: string | null }>>(
        `${base(id)}/delivery-settings`,
        dto,
      )
      .then((r) => r.data.data),

  updateTipOptions: (id: string, dto: TipOptions): Promise<RestaurantSettings> =>
    api
      .patch<Envelope<RestaurantSettings>>(`${base(id)}/tip-options`, dto)
      .then((r) => r.data.data),

  updateReceipt: (id: string, dto: ReceiptConfig): Promise<RestaurantSettings> =>
    api
      .patch<Envelope<RestaurantSettings>>(`${base(id)}/receipt`, dto)
      .then((r) => r.data.data),

  updateOrderTypes: (id: string, orderTypes: OrderType[]): Promise<RestaurantSettings> =>
    api
      .patch<Envelope<RestaurantSettings>>(`${base(id)}/order-types`, { orderTypes })
      .then((r) => r.data.data),

  updateAutoAccept: (id: string, dto: AutoAcceptConfig): Promise<RestaurantSettings> =>
    api
      .patch<Envelope<RestaurantSettings>>(`${base(id)}/auto-accept`, dto)
      .then((r) => r.data.data),

  getAutoAcceptTimer: (id: string): Promise<AutoAcceptTimerConfig> =>
    api
      .get<Envelope<AutoAcceptTimerConfig>>(`${base(id)}/auto-accept-timer`)
      .then((r) => r.data.data),

  updateQrBaseUrl: (id: string, qrBaseUrl: string | null): Promise<{ id: string; qrBaseUrl: string | null }> =>
    api
      .patch<Envelope<{ id: string; qrBaseUrl: string | null }>>(`${base(id)}/qr-settings`, { qrBaseUrl })
      .then((r) => r.data.data),

  listPaymentGateways: (id: string): Promise<PaymentGatewayConfig[]> =>
    api
      .get<Envelope<PaymentGatewayConfig[]>>(`${base(id)}/payment-gateways`)
      .then((r) => r.data.data),

  upsertPaymentGateway: (
    id: string,
    gateway: string,
    dto: { apiKey?: string; secretKey?: string; webhookSecret?: string; isLive?: boolean; isActive?: boolean },
  ): Promise<PaymentGatewayConfig> =>
    api
      .patch<Envelope<PaymentGatewayConfig>>(`${base(id)}/payment-gateways/${gateway}`, dto)
      .then((r) => r.data.data),
}
