import { api } from '@/lib/api'
import type {
  LoyaltyConfig,
  CustomerWithSegment,
  StampCard,
  StampProgress,
  PromoCode,
  PromoValidateResult,
  CampaignBroadcast,
  Review,
} from '@/types/crm.types'

const BASE = (rid: string) => `/restaurants/${rid}/crm`

export const crmApi = {
  // ── Loyalty Config ────────────────────────────────────────────────────────────
  getLoyaltyConfig: (rid: string): Promise<LoyaltyConfig> =>
    api.get(`${BASE(rid)}/loyalty-config`).then((r) => r.data.data ?? r.data),

  upsertLoyaltyConfig: (rid: string, body: Partial<LoyaltyConfig>): Promise<LoyaltyConfig> =>
    api.patch(`${BASE(rid)}/loyalty-config`, body).then((r) => r.data.data ?? r.data),

  // ── Customers ─────────────────────────────────────────────────────────────────
  listCustomers: (
    rid: string,
    q?: { segment?: string; search?: string; page?: number; limit?: number },
  ): Promise<{ customers: CustomerWithSegment[]; total: number; page: number; limit: number }> =>
    api.get(`${BASE(rid)}/customers`, { params: q }).then((r) => r.data.data ?? r.data),

  getCustomerDetail: (rid: string, id: string): Promise<any> =>
    api.get(`${BASE(rid)}/customers/${id}`).then((r) => r.data.data ?? r.data),

  // ── Promo Codes ───────────────────────────────────────────────────────────────
  listPromoCodes: (rid: string): Promise<PromoCode[]> =>
    api.get(`${BASE(rid)}/promo-codes`).then((r) => r.data.data ?? r.data),

  createPromoCode: (rid: string, body: object): Promise<PromoCode> =>
    api.post(`${BASE(rid)}/promo-codes`, body).then((r) => r.data.data ?? r.data),

  updatePromoCode: (rid: string, id: string, body: object): Promise<PromoCode> =>
    api.patch(`${BASE(rid)}/promo-codes/${id}`, body).then((r) => r.data.data ?? r.data),

  deletePromoCode: (rid: string, id: string): Promise<{ deleted: boolean }> =>
    api.delete(`${BASE(rid)}/promo-codes/${id}`).then((r) => r.data.data ?? r.data),

  validatePromo: (rid: string, body: { code: string; orderAmount: number }): Promise<PromoValidateResult> =>
    api.post(`${BASE(rid)}/promo-codes/validate`, body).then((r) => r.data.data ?? r.data),

  recordPromoUsage: (
    rid: string,
    body: { code: string; orderId?: string; customerId?: string },
  ): Promise<{ recorded: boolean }> =>
    api.post(`${BASE(rid)}/promo-codes/record-usage`, body).then((r) => r.data.data ?? r.data),

  // ── Stamp Cards ───────────────────────────────────────────────────────────────
  listStampCards: (rid: string): Promise<StampCard[]> =>
    api.get(`${BASE(rid)}/stamp-cards`).then((r) => r.data.data ?? r.data),

  createStampCard: (rid: string, body: object): Promise<StampCard> =>
    api.post(`${BASE(rid)}/stamp-cards`, body).then((r) => r.data.data ?? r.data),

  updateStampCard: (rid: string, id: string, body: object): Promise<StampCard> =>
    api.patch(`${BASE(rid)}/stamp-cards/${id}`, body).then((r) => r.data.data ?? r.data),

  deleteStampCard: (rid: string, id: string): Promise<{ deleted: boolean }> =>
    api.delete(`${BASE(rid)}/stamp-cards/${id}`).then((r) => r.data.data ?? r.data),

  addStamp: (
    rid: string,
    body: { customerId: string; stampCardId: string; count?: number },
  ): Promise<any> =>
    api.post(`${BASE(rid)}/stamp-cards/add-stamp`, body).then((r) => r.data.data ?? r.data),

  redeemStamp: (rid: string, body: { customerId: string; stampCardId: string }): Promise<any> =>
    api.post(`${BASE(rid)}/stamp-cards/redeem`, body).then((r) => r.data.data ?? r.data),

  getStampProgress: (rid: string, customerId: string): Promise<StampProgress[]> =>
    api.get(`${BASE(rid)}/stamp-cards/progress/${customerId}`).then((r) => r.data.data ?? r.data),

  // ── Campaigns ─────────────────────────────────────────────────────────────────
  listCampaigns: (rid: string): Promise<CampaignBroadcast[]> =>
    api.get(`${BASE(rid)}/campaigns`).then((r) => r.data.data ?? r.data),

  createCampaign: (rid: string, body: object): Promise<CampaignBroadcast> =>
    api.post(`${BASE(rid)}/campaigns`, body).then((r) => r.data.data ?? r.data),

  getCampaign: (rid: string, id: string): Promise<CampaignBroadcast> =>
    api.get(`${BASE(rid)}/campaigns/${id}`).then((r) => r.data.data ?? r.data),

  sendCampaign: (rid: string, id: string): Promise<CampaignBroadcast> =>
    api.post(`${BASE(rid)}/campaigns/${id}/send`).then((r) => r.data.data ?? r.data),

  // ── Reviews ───────────────────────────────────────────────────────────────────
  listReviews: (
    rid: string,
    q?: { isApproved?: boolean; page?: number; limit?: number },
  ): Promise<{ reviews: Review[]; total: number }> =>
    api
      .get(`${BASE(rid)}/reviews`, {
        params: q !== undefined ? { ...q, isApproved: q.isApproved?.toString() } : undefined,
      })
      .then((r) => r.data.data ?? r.data),

  approveReview: (rid: string, id: string): Promise<Review> =>
    api.patch(`${BASE(rid)}/reviews/${id}/approve`).then((r) => r.data.data ?? r.data),

  rejectReview: (rid: string, id: string): Promise<{ deleted: boolean }> =>
    api.delete(`${BASE(rid)}/reviews/${id}`).then((r) => r.data.data ?? r.data),
}
