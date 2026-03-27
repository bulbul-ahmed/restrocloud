export interface CartModifier {
  modifierId: string
  name: string
  priceAdjustment: number
}

export interface CartItem {
  id: string
  menuItemId: string
  name: string
  basePrice: number
  quantity: number
  modifiers: CartModifier[]
  notes?: string
  lineTotal: number
}

export interface Cart {
  cartToken: string
  items: CartItem[]
  subtotal: number
  tax: number
  serviceCharge: number
  total: number
}
