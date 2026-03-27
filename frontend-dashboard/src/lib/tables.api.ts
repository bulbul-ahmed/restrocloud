import { api } from './api'
import type { TableStatus } from '@/types/pos.types'

type Envelope<T> = { success: boolean; data: T }

export interface FloorSection {
  id: string
  name: string
  description?: string | null
  sortOrder: number
  isActive: boolean
  tables: TableRow[]
}

export interface TableRow {
  id: string
  tableNumber: string
  capacity: number
  status: TableStatus
  qrCode: string | null
  posX: number | null
  posY: number | null
  isActive: boolean
  floorSection: { id: string; name: string }
  sessions: {
    id: string
    guestCount: number
    status: string
    openedAt: string
  }[]
}

export interface QrCodeResult {
  tableId: string
  tableNumber: string
  qrToken: string
  qrUrl: string
  qrDataUri: string
}

export const tablesApi = {
  // ── Tables list (with section info) ────────────────────────────────────────
  list: (restaurantId: string) =>
    api
      .get<Envelope<TableRow[]>>(`/restaurants/${restaurantId}/tables`)
      .then((r) => r.data.data),

  createTable: (restaurantId: string, dto: {
    floorSectionId: string
    tableNumber: string
    capacity?: number
    posX?: number
    posY?: number
  }) =>
    api
      .post<Envelope<TableRow>>(`/restaurants/${restaurantId}/tables`, dto)
      .then((r) => r.data.data),

  updateTable: (restaurantId: string, tableId: string, dto: {
    tableNumber?: string
    capacity?: number
    posX?: number
    posY?: number
    isActive?: boolean
  }) =>
    api
      .patch<Envelope<TableRow>>(`/restaurants/${restaurantId}/tables/${tableId}`, dto)
      .then((r) => r.data.data),

  deleteTable: (restaurantId: string, tableId: string) =>
    api.delete(`/restaurants/${restaurantId}/tables/${tableId}`).then((r) => r.data),

  generateQrCode: (restaurantId: string, tableId: string) =>
    api
      .post<Envelope<QrCodeResult>>(
        `/restaurants/${restaurantId}/tables/${tableId}/qr-code`,
      )
      .then((r) => r.data.data),

  // ── Floor sections ──────────────────────────────────────────────────────────
  listSections: (restaurantId: string) =>
    api
      .get<Envelope<FloorSection[]>>(`/restaurants/${restaurantId}/floor-sections`)
      .then((r) => r.data.data),

  createSection: (restaurantId: string, dto: { name: string; description?: string; sortOrder?: number }) =>
    api
      .post<Envelope<FloorSection>>(`/restaurants/${restaurantId}/floor-sections`, dto)
      .then((r) => r.data.data),

  updateSection: (restaurantId: string, sectionId: string, dto: { name?: string; description?: string; sortOrder?: number }) =>
    api
      .patch<Envelope<FloorSection>>(`/restaurants/${restaurantId}/floor-sections/${sectionId}`, dto)
      .then((r) => r.data.data),

  deleteSection: (restaurantId: string, sectionId: string) =>
    api.delete(`/restaurants/${restaurantId}/floor-sections/${sectionId}`).then((r) => r.data),
}
