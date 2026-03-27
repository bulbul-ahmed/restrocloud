'use client'
import { useState } from 'react'
import { CreditCard, Smartphone, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import type { OnlineRestaurant, PaymentSession } from '../../types/online.types'
import { fmtPrice } from '../../lib/utils'

const GATEWAY_LABELS: Record<string, { label: string; color: string }> = {
  stripe: { label: 'Stripe', color: 'text-indigo-600' },
  bkash: { label: 'bKash', color: 'text-pink-600' },
  sslcommerz: { label: 'SSLCommerz', color: 'text-blue-600' },
}

interface Props {
  slug: string
  orderId: string
  orderNumber: string
  gateway: string
  session: PaymentSession
  totalAmount: number
  restaurant: OnlineRestaurant
  onComplete: () => void
  onBack: () => void
}

export default function PaymentView({ orderId, orderNumber, gateway, session, totalAmount, restaurant, onComplete, onBack }: Props) {
  const [processing, setProcessing] = useState(false)
  const gw = GATEWAY_LABELS[gateway] ?? { label: gateway.toUpperCase(), color: 'text-gray-700' }

  const handleConfirm = async () => {
    // For real Stripe Checkout: redirect to hosted payment page
    if (gateway === 'stripe' && session.checkoutUrl && !session.isMock) {
      window.location.href = session.checkoutUrl
      return
    }
    // Mock / other gateways: simulate processing
    setProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setProcessing(false)
    onComplete()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <button onClick={onBack} disabled={processing} className="p-1.5 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <h1 className="font-bold text-lg text-gray-900">Payment</h1>
      </div>

      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
        {/* Order summary */}
        <div className="bg-white rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-500">Order #{orderNumber}</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{fmtPrice(totalAmount, restaurant.currency)}</p>
          <p className="text-sm text-gray-400 mt-1">{restaurant.name}</p>
        </div>

        {/* Gateway info */}
        <div className="bg-white rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            {gateway === 'stripe' ? <CreditCard size={24} className="text-indigo-500" /> : <Smartphone size={24} className="text-pink-500" />}
            <div>
              <p className="font-semibold text-gray-900">Pay via <span className={gw.color}>{gw.label}</span></p>
              <p className="text-xs text-gray-400 mt-0.5">Secure payment processing</p>
            </div>
          </div>

          {/* Gateway-specific mock info */}
          {gateway === 'stripe' && session.clientSecret && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-xs text-indigo-700 font-medium">Stripe Payment Intent Ready</p>
              <p className="text-xs text-indigo-500 mt-0.5 font-mono truncate">{session.clientSecret}</p>
            </div>
          )}
          {gateway === 'bkash' && session.bkashURL && (
            <div className="bg-pink-50 border border-pink-100 rounded-xl p-3">
              <p className="text-xs text-pink-700 font-medium">bKash Payment URL Generated</p>
              <p className="text-xs text-pink-500 mt-0.5 font-mono truncate">{session.bkashURL}</p>
            </div>
          )}
          {gateway === 'sslcommerz' && session.redirectUrl && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 font-medium">SSLCommerz Session Ready</p>
              <p className="text-xs text-blue-500 mt-0.5 font-mono truncate">{session.redirectUrl}</p>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck size={14} className="text-green-500" />
            <span>Your payment is secured with 256-bit SSL encryption</span>
          </div>
        </div>

        {/* Action */}
        <div className="space-y-3">
          <button
            onClick={handleConfirm}
            disabled={processing}
            className="w-full bg-brand text-white font-semibold py-4 rounded-2xl text-base flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {processing ? (
              <><Loader2 size={18} className="animate-spin" /> Processing Payment...</>
            ) : gateway === 'stripe' && session.checkoutUrl && !session.isMock ? (
              `Continue to Stripe →`
            ) : (
              `Pay ${fmtPrice(totalAmount, restaurant.currency)}`
            )}
          </button>
          <p className="text-center text-xs text-gray-400">
            By completing this payment you agree to our terms
          </p>
        </div>
      </div>
    </div>
  )
}
