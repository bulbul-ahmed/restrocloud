import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, ShoppingBag, MonitorSmartphone, Tablet } from 'lucide-react'
import { BellIcon } from '@/components/icons'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { useNotificationsStore, type OrderNotification } from '@/store/notifications.store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title?: string
  breadcrumbs?: { label: string; href?: string }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function itemsSummary(items: OrderNotification['items']): string {
  if (items.length === 0) return '—'
  const first2 = items.slice(0, 2).map((i) => `${i.quantity}× ${i.name}`).join(', ')
  const extra = items.length - 2
  return extra > 0 ? `${first2} +${extra} more` : first2
}

function fmtAmount(amount: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(amount)}`
}

function channelIcon(channel: string) {
  if (channel === 'QR') return <Tablet size={13} className="text-brand" />
  if (channel === 'ONLINE') return <ShoppingBag size={13} className="text-blue-500" />
  return <MonitorSmartphone size={13} className="text-gray-500" />
}

function channelLabel(channel: string, tableNumber?: string | null): string {
  if (channel === 'QR' && tableNumber) return `QR · Table ${tableNumber}`
  if (channel === 'QR') return 'QR Order'
  if (channel === 'ONLINE') return 'Online Order'
  return 'POS Order'
}

function navigatePath(channel: string): string {
  return channel === 'QR' ? '/pos' : '/orders'
}

// ─── Notification dropdown ────────────────────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationsStore()

  function handleClick(n: OrderNotification) {
    markRead(n.id)
    onClose()
    navigate(navigatePath(n.channel))
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">Order Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-xs text-brand hover:underline font-medium"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                'w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3',
                !n.read && 'bg-orange-50/60 hover:bg-orange-50',
              )}
            >
              {/* Channel icon dot */}
              <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                {channelIcon(n.channel)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-gray-900 truncate">
                    #{n.orderNumber}
                    <span className="ml-1.5 text-gray-500 font-normal">
                      {channelLabel(n.channel, n.tableNumber)}
                    </span>
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate">{itemsSummary(n.items)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-gray-800">{fmtAmount(n.totalAmount, n.currency)}</span>
                  {!n.read && (
                    <span className="text-[9px] font-bold bg-brand text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                      New
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={() => { onClose(); navigate('/orders') }}
          className="text-xs text-brand font-medium hover:underline w-full text-center"
        >
          View all orders →
        </button>
      </div>
    </div>
  )
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

export function TopBar({ title, breadcrumbs }: TopBarProps) {
  const { openMobileSidebar } = useUIStore()
  const { user } = useAuthStore()
  const { unreadCount } = useNotificationsStore()
  const [panelOpen, setPanelOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [panelOpen])

  return (
    <header className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 flex-shrink-0">
      {/* Left: Mobile menu + Breadcrumbs/Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={openMobileSidebar}
        >
          <Menu size={20} />
        </Button>

        {breadcrumbs ? (
          <nav className="flex items-center gap-1 text-sm">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-gray-400">/</span>}
                <span className={i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        ) : null}
      </div>

      {/* Right: Search + Notifications + User */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900">
          <Search size={18} />
        </Button>

        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={() => setPanelOpen((o) => !o)}
            className={cn(
              'relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
              panelOpen ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
            )}
            aria-label="Notifications"
          >
            <BellIcon size={24} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {panelOpen && <NotificationPanel onClose={() => setPanelOpen(false)} />}
        </div>

        {/* User info */}
        <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-200">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
