import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AlertCircle, Database, Shield, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorEntry {
  timestamp: string
  method: string
  path: string
  message: string
  stack: string
  statusCode: number
}

interface ErrorLogData {
  count: number
  errors: ErrorEntry[]
}

interface HealthDetail {
  redis: {
    version: string
    uptimeSeconds: number
    connectedClients: number
    usedMemoryHuman: string
    maxMemoryHuman: string
    hitRate: number | null
    totalKeys: number
    evictedKeys: number
  }
  database: {
    tables: { name: string; rowEstimate: number; totalSize: string }[]
  }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function unwrap<T>(env: { success: boolean; data: T }): T { return env.data }

async function getErrorLog(limit = 50): Promise<ErrorLogData> {
  const { data } = await api.get<{ success: boolean; data: ErrorLogData }>('/super-admin/system/errors', { params: { limit } })
  return unwrap(data)
}

async function getHealthDetail(): Promise<HealthDetail> {
  const { data } = await api.get<{ success: boolean; data: HealthDetail }>('/super-admin/system/health-detail')
  return unwrap(data)
}

async function gdprDeleteUser(customerEmail: string) {
  const { data } = await api.post<{ success: boolean; data: any }>('/super-admin/system/gdpr/delete-user', { customerEmail })
  return unwrap(data)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'medium' })
}

function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}

// ─── Error Log Tab ────────────────────────────────────────────────────────────

function ErrorLogTab() {
  const [limit, setLimit] = useState(50)
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['system-error-log', limit],
    queryFn: () => getErrorLog(limit),
    refetchInterval: 30_000,
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Show last</span>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="bg-background border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none"
          >
            {[20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">errors · refreshes every 30s</span>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-sidebar-active rounded-lg" />)}
        </div>
      ) : !data || data.count === 0 ? (
        <div className="text-center py-12">
          <AlertCircle size={32} className="mx-auto text-green-400 mb-3" />
          <p className="text-sm text-muted-foreground">No 500 errors logged — system healthy</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{data.count} error(s) shown</p>
          {data.errors.map((e, i) => {
            const key = `${e.timestamp}-${i}`
            const isExp = expanded === key
            return (
              <div key={key} className="bg-sidebar-active rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpanded(isExp ? null : key)}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-mono">{e.statusCode}</span>
                      <span className="text-xs font-mono text-muted-foreground">{e.method} {e.path}</span>
                    </div>
                    <p className="text-sm text-foreground mt-1 truncate">{e.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(e.timestamp)}</span>
                </button>
                {isExp && e.stack && (
                  <pre className="px-4 pb-4 text-xs text-red-300/80 font-mono whitespace-pre-wrap bg-red-950/20 overflow-x-auto">
                    {e.stack}
                  </pre>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Health Detail Tab ────────────────────────────────────────────────────────

function HealthDetailTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['system-health-detail'],
    queryFn: getHealthDetail,
    staleTime: 30_000,
  })

  if (isLoading) return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 animate-pulse bg-sidebar-active rounded-lg" />)}
    </div>
  )
  if (!data) return null

  const r = data.redis

  return (
    <div className="space-y-8">
      {/* Redis */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Redis {r.version}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Uptime', value: fmtUptime(r.uptimeSeconds) },
            { label: 'Connected Clients', value: String(r.connectedClients) },
            { label: 'Used Memory', value: r.usedMemoryHuman },
            { label: 'Max Memory', value: r.maxMemoryHuman },
            { label: 'Hit Rate', value: r.hitRate !== null ? `${r.hitRate}%` : 'N/A' },
            { label: 'Total Keys', value: String(r.totalKeys) },
            { label: 'Evicted Keys', value: String(r.evictedKeys) },
          ].map(item => (
            <div key={item.label} className="bg-sidebar-active rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* DB Tables */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          PostgreSQL — Table Sizes
        </h3>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sidebar-active">
              <tr>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2">Table</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Row Estimate</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Total Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.database.tables.map(t => (
                <tr key={t.name} className="hover:bg-sidebar-active/50 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-foreground">{t.name}</td>
                  <td className="px-4 py-2 text-right text-xs text-muted-foreground">{t.rowEstimate.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-xs text-foreground font-medium">{t.totalSize}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── GDPR Tab ─────────────────────────────────────────────────────────────────

function GdprTab() {
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const deleteMut = useMutation({
    mutationFn: gdprDeleteUser,
    onSuccess: (result) => {
      toast.success(result.message ?? 'Customer PII anonymised')
      setEmail('')
      setConfirmed(false)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'GDPR deletion failed')
    },
  })

  function handleDelete() {
    if (!email.trim() || !confirmed) return
    deleteMut.mutate(email.trim())
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4 space-y-1">
        <p className="text-sm font-semibold text-red-400 flex items-center gap-2">
          <Shield size={14} />
          GDPR Right to Erasure
        </p>
        <p className="text-xs text-red-300/70">
          This action permanently anonymises all PII for the customer. Orders are preserved for accounting purposes but delivery addresses, contact info, and payment methods are deleted. This cannot be undone.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Customer Email Address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="customer@example.com"
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-red-500"
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-red-500"
          />
          <span className="text-xs text-muted-foreground">
            I confirm this is a verified GDPR erasure request and understand this action is irreversible.
          </span>
        </label>

        <button
          onClick={handleDelete}
          disabled={!email.trim() || !confirmed || deleteMut.isPending}
          className="flex items-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          {deleteMut.isPending ? 'Processing…' : 'Anonymise Customer Data'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'errors' | 'health' | 'gdpr'

const TAB_LABELS: Record<Tab, string> = {
  errors: 'Error Log',
  health: 'DB & Redis Health',
  gdpr: 'GDPR Deletion',
}

export default function SystemPage() {
  const [tab, setTab] = useState<Tab>('errors')

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">System Administration</h1>
        <p className="text-sm text-muted-foreground mt-1">Error logs, infrastructure health, and data management</p>
      </div>

      <div className="flex gap-1 p-1 bg-sidebar-active rounded-lg w-fit">
        {(['errors', 'health', 'gdpr'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {tab === 'errors' && <ErrorLogTab />}
        {tab === 'health' && <HealthDetailTab />}
        {tab === 'gdpr' && <GdprTab />}
      </div>
    </div>
  )
}
