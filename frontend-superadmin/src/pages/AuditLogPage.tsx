import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAuditLog } from '@/lib/superadmin.api'
import { apiError } from '@/lib/api'
import type { AuditEntry } from '@/types/superadmin.types'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'

function actionVariant(action: string): BadgeVariant {
  if (action.includes('SUSPENDED') || action.includes('DEACTIVATED')) return 'destructive'
  if (action.includes('ACTIVATED')) return 'success'
  if (action.includes('PLAN')) return 'info'
  if (action.includes('IMPERSONATION')) return 'warning'
  if (action.includes('CREATED')) return 'default'
  return 'outline'
}

function metaPreview(entry: AuditEntry): string {
  if (!entry.metadata) return ''
  const m = entry.metadata
  if (m.from && m.to) return `${m.from} → ${m.to}`
  if (m.restaurantName) return `${m.restaurantName}`
  if (m.email) return String(m.email)
  if (m.affectedUsers !== undefined) return `${m.affectedUsers} users affected`
  if (m.reactivatedUsers !== undefined) return `${m.reactivatedUsers} users reactivated`
  return JSON.stringify(m).slice(0, 60)
}

const LIMIT = 50

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getAuditLog(page, LIMIT)
      setEntries(res.data)
      setTotal(res.pagination.total)
      setPages(res.pagination.pages || 1)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500 mt-1">{total} total events (newest first)</p>
        </div>
        <Button variant="outline" size="sm" loading={loading} onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Actor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Target</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Details</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-4 py-3">
                          <div className="h-4 animate-pulse bg-gray-100 rounded" />
                        </td>
                      </tr>
                    ))
                  : entries.length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-gray-400">
                        No audit events yet
                      </td>
                    </tr>
                  )
                  : entries.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Badge variant={actionVariant(e.action)}>
                            {e.action.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                          {e.actorEmail}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{e.targetName}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">
                          {metaPreview(e)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
