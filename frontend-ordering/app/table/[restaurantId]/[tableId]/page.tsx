// M12 — QR Table Ordering page
import type { Metadata } from 'next'
import { QrShell } from '../../../../components/qr/QrShell'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api'

interface Props {
  params: Promise<{ restaurantId: string; tableId: string }>
}

async function fetchContext(restaurantId: string, tableId: string) {
  try {
    const res = await fetch(`${API_URL}/qr/${restaurantId}/${tableId}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data ?? json
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { restaurantId, tableId } = await params
  const ctx = await fetchContext(restaurantId, tableId)
  const name = ctx?.restaurant?.name ?? 'Restaurant'
  const table = ctx?.table?.tableNumber ?? tableId
  return {
    title: `Order at ${name} — Table ${table}`,
    description: `Browse the menu and order directly from your table at ${name}.`,
  }
}

export default async function TableQRPage({ params }: Props) {
  const { restaurantId, tableId } = await params
  const ctx = await fetchContext(restaurantId, tableId)

  if (!ctx) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Table Not Found</h1>
          <p className="text-gray-500 text-sm">
            This QR code may be invalid or the restaurant is currently offline.
            Please ask a staff member for assistance.
          </p>
        </div>
      </div>
    )
  }

  const brandRgb = ctx.restaurant.brandColor
    ? ctx.restaurant.brandColor.replace('#', '').match(/.{2}/g)?.map((h: string) => parseInt(h, 16)).join(' ')
    : '255 107 53'

  return (
    <>
      <style>{`:root { --brand-rgb: ${brandRgb}; }`}</style>
      <QrShell restaurantId={restaurantId} tableId={tableId} initialContext={ctx} />
    </>
  )
}
