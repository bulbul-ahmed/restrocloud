export interface MenuItem {
  id: string
  name: string
  basePrice: string
  isAvailable: boolean
  category?: { id: string; name: string } | null
}
