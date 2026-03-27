import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Plus, ToggleLeft, ToggleRight, Trash2, Tag, Megaphone, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReferralCode {
  id: string
  code: string
  description: string | null
  discountPct: number
  creditPct: number
  maxUses: number | null
  usedCount: number
  isActive: boolean
  createdBy: string
  createdAt: string
  _count: { usages: number }
}

interface Banner {
  id: string
  title: string
  body: string
  ctaLabel: string | null
  ctaUrl: string | null
  targetPlan: string | null
  isActive: boolean
  endsAt: string | null
  impressions: number
  createdBy: string
  createdAt: string
}

interface MarketingStats {
  referrals: { total: number; active: number; totalUsages: number; topCodes: { code: string; usedCount: number; discountPct: number; isActive: boolean }[] }
  banners: { total: number; active: number }
  broadcasts: { total: number; totalRecipients: number }
  coupons: { totalRedemptions: number }
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function unwrap<T>(env: { success: boolean; data: T }): T { return env.data }

async function getMarketingStats(): Promise<MarketingStats> {
  const { data } = await api.get<{ success: boolean; data: MarketingStats }>('/super-admin/marketing/stats')
  return unwrap(data)
}
async function listReferralCodes(): Promise<ReferralCode[]> {
  const { data } = await api.get<{ success: boolean; data: ReferralCode[] }>('/super-admin/marketing/referrals')
  return unwrap(data)
}
async function createReferralCode(payload: object): Promise<ReferralCode> {
  const { data } = await api.post<{ success: boolean; data: ReferralCode }>('/super-admin/marketing/referrals', payload)
  return unwrap(data)
}
async function toggleReferralCode(id: string): Promise<ReferralCode> {
  const { data } = await api.patch<{ success: boolean; data: ReferralCode }>(`/super-admin/marketing/referrals/${id}/toggle`)
  return unwrap(data)
}
async function listBanners(): Promise<Banner[]> {
  const { data } = await api.get<{ success: boolean; data: Banner[] }>('/super-admin/marketing/banners')
  return unwrap(data)
}
async function createBanner(payload: object): Promise<Banner> {
  const { data } = await api.post<{ success: boolean; data: Banner }>('/super-admin/marketing/banners', payload)
  return unwrap(data)
}
async function toggleBanner(id: string): Promise<Banner> {
  const { data } = await api.patch<{ success: boolean; data: Banner }>(`/super-admin/marketing/banners/${id}/toggle`)
  return unwrap(data)
}
async function deleteBanner(id: string): Promise<void> {
  await api.delete(`/super-admin/marketing/banners/${id}`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data, isLoading } = useQuery({ queryKey: ['marketing-stats'], queryFn: getMarketingStats })

  if (isLoading) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-sidebar-active rounded-xl" />)}
    </div>
  )
  if (!data) return null

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Referral Codes', value: data.referrals.active, sub: `${data.referrals.total} total` },
          { label: 'Referral Usages', value: data.referrals.totalUsages, sub: 'all time' },
          { label: 'Broadcasts Sent', value: data.broadcasts.total, sub: `${data.broadcasts.totalRecipients} recipients` },
          { label: 'Coupon Redemptions', value: data.coupons.totalRedemptions, sub: 'all time' },
        ].map(stat => (
          <div key={stat.label} className="bg-sidebar-active rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {data.referrals.topCodes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Top Referral Codes</h3>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-sidebar-active">
                <tr>
                  <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2">Code</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Uses</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Discount</th>
                  <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.referrals.topCodes.map(r => (
                  <tr key={r.code}>
                    <td className="px-4 py-2 font-mono text-sm text-foreground">{r.code}</td>
                    <td className="px-4 py-2 text-right text-sm text-muted-foreground">{r.usedCount}</td>
                    <td className="px-4 py-2 text-right text-sm text-muted-foreground">{r.discountPct}%</td>
                    <td className="px-4 py-2 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-600/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Referrals Tab ────────────────────────────────────────────────────────────

function ReferralsTab() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['referral-codes'], queryFn: listReferralCodes })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', description: '', discountPct: 10, creditPct: 5, maxUses: '' })

  const createMut = useMutation({
    mutationFn: createReferralCode,
    onSuccess: () => { toast.success('Referral code created'); setShowForm(false); setForm({ code: '', description: '', discountPct: 10, creditPct: 5, maxUses: '' }); qc.invalidateQueries({ queryKey: ['referral-codes'] }); qc.invalidateQueries({ queryKey: ['marketing-stats'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create'),
  })

  const toggleMut = useMutation({
    mutationFn: toggleReferralCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['referral-codes'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          New Referral Code
        </button>
      </div>

      {showForm && (
        <div className="bg-sidebar-active rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Code *</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SUMMER25" className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm font-mono text-foreground outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Discount %</label>
              <input type="number" min={0} max={100} value={form.discountPct} onChange={e => setForm(f => ({ ...f, discountPct: Number(e.target.value) }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Credit % for Referrer</label>
              <input type="number" min={0} max={100} value={form.creditPct} onChange={e => setForm(f => ({ ...f, creditPct: Number(e.target.value) }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Uses (blank = unlimited)</label>
              <input type="number" min={1} value={form.maxUses} onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-xs text-muted-foreground">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional description" className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate({ ...form, maxUses: form.maxUses ? Number(form.maxUses) : undefined })}
              disabled={!form.code || createMut.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg">
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse bg-sidebar-active rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No referral codes yet</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sidebar-active">
              <tr>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-2">Code</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Discount</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Credit</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Uses</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Max</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2">Status</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map(r => (
                <tr key={r.id} className="hover:bg-sidebar-active/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-foreground">
                    {r.code}
                    {r.description && <p className="text-xs text-muted-foreground font-sans">{r.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">{r.discountPct}%</td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">{r.creditPct}%</td>
                  <td className="px-4 py-3 text-right text-sm text-foreground">{r.usedCount}</td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">{r.maxUses ?? '∞'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${r.isActive ? 'bg-green-600/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => toggleMut.mutate(r.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                      {r.isActive ? <ToggleRight size={16} className="text-indigo-400" /> : <ToggleLeft size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Banners Tab ──────────────────────────────────────────────────────────────

function BannersTab() {
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['in-app-banners'], queryFn: listBanners })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', ctaLabel: '', ctaUrl: '', targetPlan: '', endsAt: '' })

  const createMut = useMutation({
    mutationFn: createBanner,
    onSuccess: () => { toast.success('Banner created'); setShowForm(false); setForm({ title: '', body: '', ctaLabel: '', ctaUrl: '', targetPlan: '', endsAt: '' }); qc.invalidateQueries({ queryKey: ['in-app-banners'] }) },
    onError: () => toast.error('Failed to create banner'),
  })

  const toggleMut = useMutation({
    mutationFn: toggleBanner,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['in-app-banners'] }),
  })

  const deleteMut = useMutation({
    mutationFn: deleteBanner,
    onSuccess: () => { toast.success('Banner deleted'); qc.invalidateQueries({ queryKey: ['in-app-banners'] }) },
    onError: () => toast.error('Failed to delete'),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors">
          <Plus size={14} />
          New Banner
        </button>
      </div>

      {showForm && (
        <div className="bg-sidebar-active rounded-xl p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { key: 'title', label: 'Title *', placeholder: 'New feature announcement' },
              { key: 'ctaLabel', label: 'CTA Label', placeholder: 'Learn More' },
              { key: 'ctaUrl', label: 'CTA URL', placeholder: 'https://...' },
              { key: 'targetPlan', label: 'Target Plan (blank = all)', placeholder: 'STARTER' },
              { key: 'endsAt', label: 'Ends At (optional)', placeholder: '' },
            ].map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs text-muted-foreground">{field.label}</label>
                <input
                  value={(form as any)[field.key]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  type={field.key === 'endsAt' ? 'datetime-local' : 'text'}
                  placeholder={field.placeholder}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground outline-none"
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Body *</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={3} placeholder="Banner message…"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => createMut.mutate({ ...form, ctaLabel: form.ctaLabel || undefined, ctaUrl: form.ctaUrl || undefined, targetPlan: form.targetPlan || undefined, endsAt: form.endsAt || undefined })}
              disabled={!form.title || !form.body || createMut.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg">
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-20 animate-pulse bg-sidebar-active rounded-lg" />)}</div>
      ) : data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No banners yet</p>
      ) : (
        <div className="space-y-3">
          {data.map(b => (
            <div key={b.id} className="bg-sidebar-active rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{b.title}</p>
                    {b.targetPlan && (
                      <span className="text-xs bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-full">{b.targetPlan}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.isActive ? 'bg-green-600/20 text-green-400' : 'bg-slate-600/20 text-slate-400'}`}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.body}</p>
                  {b.ctaLabel && <p className="text-xs text-indigo-400 mt-1">CTA: {b.ctaLabel} → {b.ctaUrl}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    {b.impressions} impressions · {b.endsAt ? `Ends ${fmtDate(b.endsAt)}` : 'No expiry'} · By {b.createdBy}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleMut.mutate(b.id)} className="text-muted-foreground hover:text-foreground transition-colors">
                    {b.isActive ? <ToggleRight size={18} className="text-indigo-400" /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => { if (confirm('Delete this banner?')) deleteMut.mutate(b.id) }}
                    className="text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'stats' | 'referrals' | 'banners'

const TAB_LABELS: Record<Tab, string> = {
  stats: 'Campaign Stats',
  referrals: 'Referral Codes',
  banners: 'In-App Banners',
}

export default function MarketingPage() {
  const [tab, setTab] = useState<Tab>('stats')

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Marketing & Growth</h1>
        <p className="text-sm text-muted-foreground mt-1">Referral codes, in-app banners, and campaign performance</p>
      </div>

      <div className="flex gap-1 p-1 bg-sidebar-active rounded-lg w-fit">
        {(['stats', 'referrals', 'banners'] as Tab[]).map(t => (
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
        {tab === 'stats' && <StatsTab />}
        {tab === 'referrals' && <ReferralsTab />}
        {tab === 'banners' && <BannersTab />}
      </div>
    </div>
  )
}
