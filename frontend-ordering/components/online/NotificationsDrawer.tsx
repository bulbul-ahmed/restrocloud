'use client'
import { useState, useEffect } from 'react'
import { X, Bell, CheckCheck } from 'lucide-react'
import { toast } from 'sonner'
import * as onlineApi from '../../lib/online.api'
import type { CustomerNotification } from '../../types/online.types'

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

interface Props {
  slug: string
  token: string
  onClose: () => void
  onUnreadChange: (count: number) => void
}

export default function NotificationsDrawer({ slug, token, onClose, onUnreadChange }: Props) {
  const [notifications, setNotifications] = useState<CustomerNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)

  useEffect(() => {
    onlineApi.getMyNotifications(slug, token)
      .then(res => {
        const notifs: CustomerNotification[] = (res as any)?.notifications ?? (res as any)?.data ?? []
        const u = (res as any)?.unread ?? 0
        setNotifications(notifs)
        setUnread(u)
        onUnreadChange(u)
      })
      .catch(() => toast.error('Failed to load notifications'))
      .finally(() => setLoading(false))
  }, [slug, token, onUnreadChange])

  const markRead = async (id: string) => {
    const notif = notifications.find(n => n.id === id)
    if (!notif || notif.isRead) return
    try {
      await onlineApi.markNotificationRead(slug, token, id)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      const newUnread = Math.max(0, unread - 1)
      setUnread(newUnread)
      onUnreadChange(newUnread)
    } catch { /* silent */ }
  }

  const markAll = async () => {
    if (unread === 0) return
    setMarkingAll(true)
    try {
      await onlineApi.markAllNotificationsRead(slug, token)
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnread(0)
      onUnreadChange(0)
    } catch { toast.error('Failed to mark all read') } finally { setMarkingAll(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-sm h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-gray-700" />
            <h2 className="font-bold text-gray-900">Notifications</h2>
            {unread > 0 && (
              <span className="text-xs bg-brand text-white px-2 py-0.5 rounded-full">{unread}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={markingAll}
                className="flex items-center gap-1 text-xs text-brand font-medium"
              >
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
              <X size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Bell size={36} className="text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No notifications</p>
              <p className="text-sm text-gray-400 mt-1">We'll notify you about your orders here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => markRead(notif.id)}
                  className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${!notif.isRead ? 'bg-brand/5' : ''}`}
                >
                  <div className="flex gap-3 items-start">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notif.isRead ? 'bg-brand' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!notif.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </p>
                      {notif.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body}</p>}
                      <p className="text-xs text-gray-400 mt-1">{fmtTime(notif.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
