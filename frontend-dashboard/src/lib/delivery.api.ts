import { api } from './api'
import type {
  DeliveryZone,
  Driver,
  Delivery,
  DeliveryLocation,
  DeliveryAnalytics,
  DeliveryPage,
  CreateZoneDto,
  UpdateZoneDto,
  CreateDriverDto,
  CreateDeliveryDto,
  AssignDriverDto,
  UpdateDeliveryStatusDto,
  ListDeliveriesQuery,
  DeliveryAnalyticsQuery,
} from '@/types/delivery.types'

type Env<T> = { data: T }

const BASE = (rid: string) => `/restaurants/${rid}/delivery`

export const deliveryApi = {
  // ─── Zones ────────────────────────────────────────────────────────────────
  listZones: (rid: string) =>
    api.get<Env<DeliveryZone[]>>(`${BASE(rid)}/zones`).then((r) => r.data.data),

  createZone: (rid: string, dto: CreateZoneDto) =>
    api.post<Env<DeliveryZone>>(`${BASE(rid)}/zones`, dto).then((r) => r.data.data),

  updateZone: (rid: string, zoneId: string, dto: UpdateZoneDto) =>
    api
      .patch<Env<DeliveryZone>>(`${BASE(rid)}/zones/${zoneId}`, dto)
      .then((r) => r.data.data),

  deleteZone: (rid: string, zoneId: string) =>
    api.delete(`${BASE(rid)}/zones/${zoneId}`).then((r) => r.data),

  // ─── Drivers ──────────────────────────────────────────────────────────────
  listDrivers: (rid: string) =>
    api.get<Env<Driver[]>>(`${BASE(rid)}/drivers`).then((r) => r.data.data),

  createDriver: (rid: string, dto: CreateDriverDto) =>
    api.post<Env<Driver>>(`${BASE(rid)}/drivers`, dto).then((r) => r.data.data),

  toggleDriver: (rid: string, driverId: string) =>
    api
      .patch<Env<Driver>>(`${BASE(rid)}/drivers/${driverId}/toggle`)
      .then((r) => r.data.data),

  // ─── Deliveries ────────────────────────────────────────────────────────────
  listDeliveries: (rid: string, params?: ListDeliveriesQuery) =>
    api
      .get<Env<DeliveryPage>>(`${BASE(rid)}`, { params })
      .then((r) => r.data.data),

  getDelivery: (rid: string, deliveryId: string) =>
    api.get<Env<Delivery>>(`${BASE(rid)}/${deliveryId}`).then((r) => r.data.data),

  createDelivery: (rid: string, dto: CreateDeliveryDto) =>
    api.post<Env<Delivery>>(`${BASE(rid)}`, dto).then((r) => r.data.data),

  assignDriver: (rid: string, deliveryId: string, dto: AssignDriverDto) =>
    api
      .patch<Env<Delivery>>(`${BASE(rid)}/${deliveryId}/assign`, dto)
      .then((r) => r.data.data),

  updateStatus: (rid: string, deliveryId: string, dto: UpdateDeliveryStatusDto) =>
    api
      .patch<Env<Delivery>>(`${BASE(rid)}/${deliveryId}/status`, dto)
      .then((r) => r.data.data),

  getDriverLocation: (rid: string, deliveryId: string) =>
    api
      .get<Env<DeliveryLocation>>(`${BASE(rid)}/${deliveryId}/driver/location`)
      .then((r) => r.data.data),

  // ─── Analytics ────────────────────────────────────────────────────────────
  getAnalytics: (rid: string, params?: DeliveryAnalyticsQuery) =>
    api
      .get<Env<DeliveryAnalytics>>(`${BASE(rid)}/analytics`, { params })
      .then((r) => r.data.data),
}
