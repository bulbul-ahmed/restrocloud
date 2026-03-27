'use client'
import { useState, useEffect } from 'react'
import { ArrowLeft, ChevronRight, MapPin, Star } from 'lucide-react'
import type { OnlineCart, OnlineRestaurant, DeliveryAddress, SavedAddress, LoyaltyAccount } from '../../types/online.types'
import * as onlineApi from '../../lib/online.api'
import { fmtPrice } from '../../lib/utils'

const COD_LABELS: Record<string, string> = {
  DELIVERY: 'Cash on Delivery',
  TAKEAWAY: 'Pay at Pickup',
}

interface Gateway { id: string; label: string }

interface PlaceOrderParams {
  orderType: string
  deliveryAddress?: DeliveryAddress
  notes?: string
  tip?: number
  redeemPoints?: number
  paymentGateway: string
  guestName?: string
  guestPhone?: string
}

interface Props {
  cart: OnlineCart
  restaurant: OnlineRestaurant
  slug: string
  token: string | null
  customerName?: string | null
  onBack: () => void
  onAuthRequired: (mode: 'login' | 'register') => void
  onPlaceOrder: (params: PlaceOrderParams) => Promise<void>
}

const VALID_ORDER_TYPES = ['DELIVERY', 'TAKEAWAY']

export default function CheckoutView({ cart, restaurant, slug, token, customerName, onBack, onAuthRequired, onPlaceOrder }: Props) {
  const validTypes = restaurant.orderTypes.filter(t => VALID_ORDER_TYPES.includes(t))
  const [orderType, setOrderType] = useState<string>(validTypes[0] ?? 'TAKEAWAY')
  const [address, setAddress] = useState<DeliveryAddress>({ line1: '', city: '', line2: '', area: '' })
  const [tipPercent, setTipPercent] = useState<number>(0)
  const [notes, setNotes] = useState('')
  const [paymentGateway, setPaymentGateway] = useState('cod')
  const [gateways, setGateways] = useState<Gateway[]>([{ id: 'cod', label: 'Cash on Delivery' }])
  const [placing, setPlacing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')

  // Loyalty
  const [loyalty, setLoyalty] = useState<LoyaltyAccount | null>(null)
  const [redeemPoints, setRedeemPoints] = useState(0)
  const [redeemEnabled, setRedeemEnabled] = useState(false)

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)

  // Fetch enabled payment methods from backend
  useEffect(() => {
    onlineApi.getPaymentMethods(slug).then(({ methods }) => {
      setGateways(methods.length > 0 ? methods : [{ id: 'cod', label: 'COD' }])
      setPaymentGateway(methods[0]?.id ?? 'cod')
    }).catch(() => {
      setGateways([{ id: 'cod', label: 'COD' }])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug])

  useEffect(() => {
    if (!token) return
    // Fetch loyalty + saved addresses in parallel
    onlineApi.getMyLoyalty(slug, token).then(l => {
      setLoyalty(l)
      setRedeemPoints(Math.min(l.points, Math.floor(cart.subtotal)))
    }).catch(() => {})
    onlineApi.getMyAddresses(slug, token).then(addrs => {
      const list = Array.isArray(addrs) ? addrs : []
      setSavedAddresses(list)
      const def = list.find(a => a.isDefault)
      if (def) {
        setSelectedAddressId(def.id)
        setAddress({ line1: def.line1, line2: def.line2 ?? '', area: def.area ?? '', city: def.city })
      }
    }).catch(() => {})
  }, [slug, token, cart.subtotal])

  const handleSelectSavedAddress = (addr: SavedAddress) => {
    setSelectedAddressId(addr.id)
    setAddress({ line1: addr.line1, line2: addr.line2 ?? '', area: addr.area ?? '', city: addr.city })
  }

  const taxRate = Number(restaurant.taxRate) / 100
  const taxEstimate = restaurant.taxInclusive ? 0 : cart.subtotal * taxRate
  const svcEstimate = cart.subtotal * (Number(restaurant.serviceCharge) / 100)
  const tipAmt = cart.subtotal * (tipPercent / 100)
  const deliveryFee = orderType === 'DELIVERY' ? Number(restaurant.deliveryFee ?? 0) : 0
  const pointsDiscount = redeemEnabled ? redeemPoints : 0
  const total = Math.max(0, cart.subtotal + taxEstimate + svcEstimate + tipAmt + deliveryFee - pointsDiscount)

  const minOrder = Number(restaurant.minimumOrderAmount ?? 0)

  const validate = (): string[] => {
    const errs: string[] = []
    if (!token) {
      if (!guestName.trim()) errs.push('Your name is required')
      if (!guestPhone.trim()) errs.push('Your phone number is required')
    }
    if (orderType === 'DELIVERY') {
      if (!address.line1.trim()) errs.push('Delivery address is required')
      if (!address.city.trim()) errs.push('City is required')
    }
    if (minOrder > 0 && cart.subtotal < minOrder) {
      errs.push(`Minimum order is ${fmtPrice(minOrder, restaurant.currency)}`)
    }
    return errs
  }

  const handlePlace = async () => {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    setPlacing(true)
    try {
      await onPlaceOrder({
        orderType,
        deliveryAddress: orderType === 'DELIVERY' ? address : undefined,
        notes: notes.trim() || undefined,
        tip: tipAmt > 0 ? tipAmt : undefined,
        redeemPoints: redeemEnabled && redeemPoints > 0 ? redeemPoints : undefined,
        paymentGateway,
        guestName: !token ? guestName.trim() : undefined,
        guestPhone: !token ? guestPhone.trim() : undefined,
      })
    } finally {
      setPlacing(false)
    }
  }

  const tipOptions = restaurant.tipOptions?.length ? restaurant.tipOptions : [5, 10, 15, 20]

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-lg text-gray-900">Checkout</h1>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">
        {/* Order type */}
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Order Type</h2>
          <div className="flex gap-2 flex-wrap">
            {validTypes.map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  orderType === t
                    ? 'bg-brand text-white border-brand'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery address */}
        {orderType === 'DELIVERY' && (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Delivery Address</h2>

            {/* Saved addresses picker */}
            {savedAddresses.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500">Saved addresses</p>
                {savedAddresses.map(addr => (
                  <button
                    key={addr.id}
                    onClick={() => handleSelectSavedAddress(addr)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-colors ${
                      selectedAddressId === addr.id
                        ? 'border-brand bg-brand/10'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <MapPin size={14} className="text-brand shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700">{addr.label ?? addr.line1}</p>
                      <p className="text-xs text-gray-400">{[addr.line1, addr.area, addr.city].filter(Boolean).join(', ')}</p>
                    </div>
                    {addr.isDefault && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full shrink-0">Default</span>}
                  </button>
                ))}
                <button
                  onClick={() => { setSelectedAddressId(null); setAddress({ line1: '', city: '', line2: '', area: '' }) }}
                  className="text-xs text-brand font-medium"
                >
                  + Enter a different address
                </button>
              </div>
            )}

            {/* Manual address input */}
            {(savedAddresses.length === 0 || selectedAddressId === null) && (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Street address *"
                  value={address.line1}
                  onChange={(e) => setAddress({ ...address, line1: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <input
                  type="text"
                  placeholder="Apartment / floor (optional)"
                  value={address.line2 ?? ''}
                  onChange={(e) => setAddress({ ...address, line2: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Area"
                    value={address.area ?? ''}
                    onChange={(e) => setAddress({ ...address, area: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                  <input
                    type="text"
                    placeholder="City *"
                    value={address.city}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loyalty redemption (FO-10) */}
        {loyalty && loyalty.points > 0 && (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-yellow-400 fill-yellow-400" />
                <h2 className="font-semibold text-gray-900">Loyalty Points</h2>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-gray-500">{loyalty.points} pts</span>
                <div
                  onClick={() => setRedeemEnabled(e => !e)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${redeemEnabled ? 'bg-brand' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${redeemEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </label>
            </div>
            {redeemEnabled && (
              <div className="bg-brand/10 border border-brand/20 rounded-xl p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand">Redeeming {redeemPoints} points</span>
                  <span className="font-semibold text-brand">-{fmtPrice(redeemPoints, restaurant.currency)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.min(loyalty.points, Math.floor(cart.subtotal))}
                  value={redeemPoints}
                  onChange={e => setRedeemPoints(Number(e.target.value))}
                  className="w-full mt-2 accent-brand"
                />
              </div>
            )}
          </div>
        )}

        {/* Payment method (FO-7) */}
        <div className="bg-white rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Payment Method</h2>
          <div className="space-y-2">
            {gateways.map(gw => (
              <button
                key={gw.id}
                onClick={() => setPaymentGateway(gw.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                  paymentGateway === gw.id
                    ? 'border-brand bg-brand/10'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  paymentGateway === gw.id ? 'border-brand' : 'border-gray-300'
                }`}>
                  {paymentGateway === gw.id && <div className="w-2 h-2 rounded-full bg-brand" />}
                </div>
                <span className="text-sm text-gray-900 font-medium">{gw.id === 'cod' ? (COD_LABELS[orderType] ?? gw.label) : gw.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tip */}
        {tipOptions.length > 0 && (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Add a Tip</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTipPercent(0)}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${tipPercent === 0 ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}
              >
                None
              </button>
              {tipOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => setTipPercent(t)}
                  className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${tipPercent === t ? 'bg-brand text-white border-brand' : 'border-gray-200 text-gray-600'}`}
                >
                  {t}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 space-y-2">
          <h2 className="font-semibold text-gray-900">Order Notes</h2>
          <textarea
            placeholder="Any special instructions..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />
        </div>

        {/* Guest details (shown only when not logged in) */}
        {!token && (
          <div className="bg-white rounded-2xl p-4 space-y-3">
            <h2 className="font-semibold text-gray-900">Your Details</h2>
            <input
              type="text"
              placeholder="Your name *"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <input
              type="tel"
              placeholder="Phone number *"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {/* Auth nudge */}
            <button
              onClick={() => onAuthRequired('login')}
              className="w-full bg-brand/10 border border-brand/30 rounded-xl px-4 py-3 text-left flex items-center gap-3"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-brand">Have an account? Log in instead</p>
                <p className="text-xs text-brand/70 mt-0.5">Earn loyalty points on every order</p>
              </div>
              <ChevronRight size={16} className="text-brand/50" />
            </button>
          </div>
        )}

        {/* Order summary */}
        <div className="bg-white rounded-2xl p-4 space-y-2">
          <h2 className="font-semibold text-gray-900 mb-3">Order Summary</h2>
          {cart.items.map((item) => (
            <div key={item.cartItemId} className="flex justify-between text-sm text-gray-600">
              <span>{item.quantity}× {item.name}</span>
              <span>{fmtPrice(item.totalPrice, restaurant.currency)}</span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-2 mt-2 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{fmtPrice(cart.subtotal, restaurant.currency)}</span>
            </div>
            {!restaurant.taxInclusive && taxEstimate > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tax</span><span>{fmtPrice(taxEstimate, restaurant.currency)}</span>
              </div>
            )}
            {svcEstimate > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Service</span><span>{fmtPrice(svcEstimate, restaurant.currency)}</span>
              </div>
            )}
            {tipAmt > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Tip ({tipPercent}%)</span><span>{fmtPrice(tipAmt, restaurant.currency)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery fee</span><span>{fmtPrice(deliveryFee, restaurant.currency)}</span>
              </div>
            )}
            {pointsDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600 font-medium">
                <span>Loyalty discount</span><span>-{fmtPrice(pointsDiscount, restaurant.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-100">
              <span>Total</span><span className="text-brand">{fmtPrice(total, restaurant.currency)}</span>
            </div>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {errors.map((e, i) => <p key={i} className="text-sm text-red-600">{e}</p>)}
          </div>
        )}
      </div>

      {/* Place order button */}
      <div className="px-4 pb-10 max-w-lg mx-auto">
        <button
          onClick={handlePlace}
          disabled={placing}
          className="w-full bg-brand text-white font-bold py-3.5 rounded-2xl text-base disabled:opacity-60 active:scale-[0.98] transition-transform"
        >
          {placing ? 'Placing Order...' : `Place Order · ${fmtPrice(total, restaurant.currency)}`}
        </button>
      </div>
    </div>
  )
}
