import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Search,
  Star,
  Check,
  X,
  Send,
  Plus,
  Trash2,
  Stamp,
  Gift,
  Users,
  Tag,
  Megaphone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { useAuthStore } from '@/store/auth.store'
import { crmApi } from '@/lib/crm.api'
import { apiError } from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import type {
  CustomerWithSegment,
  LoyaltyConfig,
  StampCard,
  PromoCode,
  CampaignBroadcast,
  Review,
  CustomerSegment,
} from '@/types/crm.types'

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="flex-1 overflow-y-auto p-6">{children}</div>
    </div>
  )
}

// ─── Segment badge ─────────────────────────────────────────────────────────────

const SEGMENT_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  REGULAR: 'bg-green-100 text-green-800',
  VIP: 'bg-purple-100 text-purple-800',
  DORMANT: 'bg-gray-100 text-gray-600',
  AT_RISK: 'bg-red-100 text-red-700',
}

function SegmentBadge({ segment }: { segment: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEGMENT_COLORS[segment] ?? 'bg-gray-100 text-gray-600'}`}>
      {segment}
    </span>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </span>
  )
}

// ─── Tab 1: Customers ─────────────────────────────────────────────────────────

const SEGMENTS: Array<{ label: string; value: string }> = [
  { label: 'All', value: 'ALL' },
  { label: 'New', value: 'NEW' },
  { label: 'Regular', value: 'REGULAR' },
  { label: 'VIP', value: 'VIP' },
  { label: 'Dormant', value: 'DORMANT' },
  { label: 'At Risk', value: 'AT_RISK' },
]

function CustomersTab({ restaurantId }: { restaurantId: string }) {
  const [segment, setSegment] = useState('ALL')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'customers', restaurantId, segment, search],
    queryFn: () =>
      crmApi.listCustomers(restaurantId, {
        segment: segment === 'ALL' ? undefined : segment,
        search: search || undefined,
        limit: 50,
      }),
    enabled: !!restaurantId,
  })

  const { data: detail } = useQuery({
    queryKey: ['crm', 'customer-detail', restaurantId, expanded],
    queryFn: () => crmApi.getCustomerDetail(restaurantId, expanded!),
    enabled: !!expanded,
  })

  const customers = data?.customers ?? []

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {SEGMENTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSegment(s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                segment === s.value
                  ? 'bg-brand text-white border-brand'
                  : 'bg-white border-border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading customers…</div>
        ) : customers.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No customers found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Segment</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Last Order</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Tier</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Points</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => (
                <>
                  <tr
                    key={c.id}
                    className="hover:bg-surface-muted cursor-pointer"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {c.firstName} {c.lastName ?? ''}
                      </p>
                      <p className="text-xs text-gray-500">{c.email ?? c.phone ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <SegmentBadge segment={c.segment} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">{c.totalOrders}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.loyaltyTier ? (
                        <span className="text-xs font-medium text-purple-700">{c.loyaltyTier}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{c.loyaltyPoints}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {expanded === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr key={`${c.id}-detail`}>
                      <td colSpan={7} className="bg-surface-muted px-4 py-3">
                        {!detail ? (
                          <p className="text-xs text-gray-400">Loading…</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Recent Orders</p>
                              {detail.orders?.length === 0 ? (
                                <p className="text-gray-400">No orders yet</p>
                              ) : (
                                detail.orders?.slice(0, 5).map((o: any) => (
                                  <div key={o.id} className="flex justify-between py-0.5">
                                    <span className="font-mono text-gray-600">{o.orderNumber}</span>
                                    <span className="text-gray-500">{formatCurrency(Number(o.totalAmount))}</span>
                                    <Badge variant="secondary" className="text-2xs">{o.status}</Badge>
                                  </div>
                                ))
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-700 mb-2">Stamp Progress</p>
                              {detail.stampProgresses?.length === 0 ? (
                                <p className="text-gray-400">No stamp cards enrolled</p>
                              ) : (
                                detail.stampProgresses?.map((sp: any) => (
                                  <div key={sp.id} className="flex justify-between py-0.5">
                                    <span className="text-gray-600">{sp.stampCard?.name}</span>
                                    <span className="text-gray-500">{sp.stamps}/{sp.stampCard?.stampsRequired} stamps</span>
                                    {sp.completedAt && !sp.redeemedAt && (
                                      <Badge variant="success" className="text-2xs">Ready</Badge>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <div className="px-4 py-2 border-t border-border text-xs text-gray-500">
            Showing {customers.length} of {data.total} customers
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 2: Loyalty Config ─────────────────────────────────────────────────────

function LoyaltyTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'loyalty-config', restaurantId],
    queryFn: () => crmApi.getLoyaltyConfig(restaurantId),
    enabled: !!restaurantId,
  })

  const [form, setForm] = useState<Partial<LoyaltyConfig>>({})
  const dirty = Object.keys(form).length > 0

  const saveMutation = useMutation({
    mutationFn: () => crmApi.upsertLoyaltyConfig(restaurantId, { ...data, ...form }),
    onSuccess: () => {
      toast.success('Loyalty config saved')
      setForm({})
      qc.invalidateQueries({ queryKey: ['crm', 'loyalty-config', restaurantId] })
    },
    onError: (err) => toast.error(apiError(err)),
  })

  if (isLoading || !data) {
    return <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
  }

  const merged = { ...data, ...form }

  const field = (key: keyof LoyaltyConfig, label: string, type: 'number' | 'boolean' = 'number') => {
    if (type === 'boolean') {
      return (
        <div key={key} className="flex items-center justify-between py-3 border-b border-border">
          <Label className="font-medium text-gray-700">{label}</Label>
          <Switch
            checked={merged[key] as boolean}
            onCheckedChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
          />
        </div>
      )
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label className="text-gray-700">{label}</Label>
        <Input
          type="number"
          value={String(merged[key] ?? '')}
          onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
          className="max-w-xs"
        />
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white rounded-xl border border-border p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Points & Tiers</h2>
        {field('pointsPerSpend', 'Points per 1 BDT spent')}
        {field('bronzeThreshold', 'Bronze threshold (total points earned)')}
        {field('silverThreshold', 'Silver threshold')}
        {field('goldThreshold', 'Gold threshold')}
        {field('platinumThreshold', 'Platinum threshold')}
        {field('pointsExpiryDays', 'Points expiry (days, blank = no expiry)')}
        {field('isEnabled', 'Loyalty program enabled', 'boolean')}
      </div>
      <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!dirty}>
        Save Changes
      </Button>
    </div>
  )
}

// ─── Tab 3: Stamp Cards ────────────────────────────────────────────────────────

function StampCardsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editCard, setEditCard] = useState<StampCard | null>(null)
  const [stampDialog, setStampDialog] = useState<StampCard | null>(null)
  const [stampCustomerId, setStampCustomerId] = useState('')
  const [stampCount, setStampCount] = useState(1)

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['crm', 'stamp-cards', restaurantId],
    queryFn: () => crmApi.listStampCards(restaurantId),
    enabled: !!restaurantId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm', 'stamp-cards', restaurantId] })

  const createMutation = useMutation({
    mutationFn: (body: object) => crmApi.createStampCard(restaurantId, body),
    onSuccess: () => { toast.success('Stamp card created'); setCreateOpen(false); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => crmApi.updateStampCard(restaurantId, id, body),
    onSuccess: () => { toast.success('Updated'); setEditCard(null); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteStampCard(restaurantId, id),
    onSuccess: () => { toast.success('Deleted'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const addStampMutation = useMutation({
    mutationFn: () =>
      crmApi.addStamp(restaurantId, {
        customerId: stampCustomerId,
        stampCardId: stampDialog!.id,
        count: stampCount,
      }),
    onSuccess: (res) => {
      toast.success(`${res.stamps} stamp(s) — ${res.isComplete ? 'Card complete! 🎉' : 'In progress'}`)
      setStampDialog(null)
      setStampCustomerId('')
      setStampCount(1)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      crmApi.updateStampCard(restaurantId, id, { isActive }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus size={14} /> New Stamp Card
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : cards.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No stamp cards yet</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.id} className="bg-white border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{card.name}</p>
                  {card.description && <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>}
                </div>
                <Switch
                  checked={card.isActive}
                  onCheckedChange={(v) => toggleActiveMutation.mutate({ id: card.id, isActive: v })}
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Stamp size={14} className="text-brand" />
                <span>{card.stampsRequired} stamps required</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Gift size={14} className="text-green-500" />
                <span>{card.rewardDesc}</span>
                {card.rewardValue && <span className="text-green-600">({formatCurrency(card.rewardValue)})</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setStampDialog(card)}>
                  Add Stamp
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditCard(card)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 hover:bg-red-50"
                  onClick={() => deleteMutation.mutate(card.id)}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <StampCardFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(body) => createMutation.mutate(body)}
        loading={createMutation.isPending}
      />

      {/* Edit dialog */}
      {editCard && (
        <StampCardFormDialog
          open
          initial={editCard}
          onClose={() => setEditCard(null)}
          onSave={(body) => updateMutation.mutate({ id: editCard.id, body })}
          loading={updateMutation.isPending}
        />
      )}

      {/* Add stamp dialog */}
      {stampDialog && (
        <Dialog open onOpenChange={(o) => !o && setStampDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Stamp — {stampDialog.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Customer ID</Label>
                <Input
                  placeholder="Paste customer UUID…"
                  value={stampCustomerId}
                  onChange={(e) => setStampCustomerId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Stamps to add</Label>
                <Input
                  type="number"
                  min={1}
                  value={stampCount}
                  onChange={(e) => setStampCount(Number(e.target.value))}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={() => addStampMutation.mutate()} loading={addStampMutation.isPending}>
                Add Stamp
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function StampCardFormDialog({
  open,
  onClose,
  onSave,
  loading,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (body: object) => void
  loading: boolean
  initial?: StampCard
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    stampsRequired: initial?.stampsRequired ?? 10,
    rewardDesc: initial?.rewardDesc ?? '',
    rewardValue: initial?.rewardValue ?? '',
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Stamp Card' : 'Create Stamp Card'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Stamps Required *</Label>
            <Input type="number" min={1} value={form.stampsRequired} onChange={(e) => setForm((f) => ({ ...f, stampsRequired: Number(e.target.value) }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Reward Description *</Label>
            <Input value={form.rewardDesc} onChange={(e) => setForm((f) => ({ ...f, rewardDesc: e.target.value }))} placeholder="e.g. Free Coffee" />
          </div>
          <div className="space-y-1.5">
            <Label>Reward Value (optional)</Label>
            <Input type="number" value={String(form.rewardValue)} onChange={(e) => setForm((f) => ({ ...f, rewardValue: e.target.value }))} placeholder="0" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            onClick={() =>
              onSave({
                name: form.name,
                description: form.description || undefined,
                stampsRequired: form.stampsRequired,
                rewardDesc: form.rewardDesc,
                rewardValue: form.rewardValue ? Number(form.rewardValue) : undefined,
              })
            }
            loading={loading}
          >
            {initial ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab 4: Promo Codes ────────────────────────────────────────────────────────

function PromoCodesTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editPromo, setEditPromo] = useState<PromoCode | null>(null)
  const [testCode, setTestCode] = useState('')
  const [testAmount, setTestAmount] = useState('')
  const [testResult, setTestResult] = useState<any>(null)

  const { data: promos = [], isLoading } = useQuery({
    queryKey: ['crm', 'promo-codes', restaurantId],
    queryFn: () => crmApi.listPromoCodes(restaurantId),
    enabled: !!restaurantId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm', 'promo-codes', restaurantId] })

  const createMutation = useMutation({
    mutationFn: (body: object) => crmApi.createPromoCode(restaurantId, body),
    onSuccess: () => { toast.success('Promo code created'); setCreateOpen(false); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) => crmApi.updatePromoCode(restaurantId, id, body),
    onSuccess: () => { toast.success('Updated'); setEditPromo(null); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deletePromoCode(restaurantId, id),
    onSuccess: () => { toast.success('Deleted'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      crmApi.updatePromoCode(restaurantId, id, { isActive }),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(apiError(err)),
  })

  async function handleTest() {
    if (!testCode || !testAmount) return
    try {
      const res = await crmApi.validatePromo(restaurantId, {
        code: testCode.toUpperCase(),
        orderAmount: Number(testAmount),
      })
      setTestResult(res)
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <div className="space-y-4">
      {/* Inline tester */}
      <div className="bg-white border border-border rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Test Promo Code</p>
        <div className="flex gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Code</Label>
            <Input
              placeholder="WELCOME20"
              value={testCode}
              onChange={(e) => { setTestCode(e.target.value); setTestResult(null) }}
              className="w-36 uppercase"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Order Amount</Label>
            <Input
              type="number"
              placeholder="500"
              value={testAmount}
              onChange={(e) => { setTestAmount(e.target.value); setTestResult(null) }}
              className="w-28"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleTest}>Validate</Button>
          {testResult && (
            <div className={`text-sm font-medium px-3 py-1.5 rounded-lg ${testResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.valid
                ? `✓ Discount: ${formatCurrency(testResult.discountAmount)}`
                : `✗ ${testResult.reason}`}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus size={14} /> New Promo Code
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
        ) : promos.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No promo codes yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-muted border-b border-border">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Min Order</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Uses</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Valid Until</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {promos.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3 font-mono font-semibold text-gray-900">{p.code}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.discountType === 'PERCENT' ? `${p.discountValue}%` : formatCurrency(p.discountValue)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {p.minOrderAmount > 0 ? formatCurrency(p.minOrderAmount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                    {p.validUntil ? new Date(p.validUntil).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={p.isActive}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: p.id, isActive: v })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditPromo(p)}>Edit</Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => deleteMutation.mutate(p.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PromoFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(body) => createMutation.mutate(body)}
        loading={createMutation.isPending}
      />
      {editPromo && (
        <PromoFormDialog
          open
          initial={editPromo}
          onClose={() => setEditPromo(null)}
          onSave={(body) => updateMutation.mutate({ id: editPromo.id, body })}
          loading={updateMutation.isPending}
        />
      )}
    </div>
  )
}

function PromoFormDialog({
  open,
  onClose,
  onSave,
  loading,
  initial,
}: {
  open: boolean
  onClose: () => void
  onSave: (body: object) => void
  loading: boolean
  initial?: PromoCode
}) {
  const [form, setForm] = useState({
    code: initial?.code ?? '',
    discountType: initial?.discountType ?? 'PERCENT',
    discountValue: initial?.discountValue ?? '',
    minOrderAmount: initial?.minOrderAmount ?? '',
    maxUses: initial?.maxUses ?? '',
    validFrom: initial?.validFrom ? initial.validFrom.split('T')[0] : '',
    validUntil: initial?.validUntil ? initial.validUntil.split('T')[0] : '',
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Promo Code' : 'Create Promo Code'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Code *</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="WELCOME20"
              className="uppercase"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <select
                value={form.discountType}
                onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as any }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="PERCENT">Percent (%)</option>
                <option value="FLAT">Flat amount</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Value *</Label>
              <Input type="number" value={String(form.discountValue)} onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min Order</Label>
              <Input type="number" value={String(form.minOrderAmount)} onChange={(e) => setForm((f) => ({ ...f, minOrderAmount: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Max Uses</Label>
              <Input type="number" value={String(form.maxUses)} onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))} placeholder="Unlimited" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valid From</Label>
              <Input type="date" value={form.validFrom} onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until</Label>
              <Input type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            onClick={() =>
              onSave({
                code: form.code,
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
                maxUses: form.maxUses ? Number(form.maxUses) : undefined,
                validFrom: form.validFrom || undefined,
                validUntil: form.validUntil || undefined,
              })
            }
            loading={loading}
          >
            {initial ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab 5: Campaigns ─────────────────────────────────────────────────────────

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
}

function CampaignsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['crm', 'campaigns', restaurantId],
    queryFn: () => crmApi.listCampaigns(restaurantId),
    enabled: !!restaurantId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm', 'campaigns', restaurantId] })

  const createMutation = useMutation({
    mutationFn: (body: object) => crmApi.createCampaign(restaurantId, body),
    onSuccess: () => { toast.success('Campaign saved as draft'); setCreateOpen(false); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => crmApi.sendCampaign(restaurantId, id),
    onSuccess: (res) => { toast.success(`Campaign sent to ${res.sentCount} recipients`); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus size={14} /> New Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : campaigns.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No campaigns yet</div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CAMPAIGN_STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                    <Badge variant="secondary" className="text-2xs">{c.channel}</Badge>
                    <SegmentBadge segment={c.segment} />
                  </div>
                  {c.subject && <p className="text-sm text-gray-600 mt-1">{c.subject}</p>}
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{c.body}</p>
                  {c.sentAt && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Sent {new Date(c.sentAt).toLocaleString()} · {c.sentCount} recipients
                    </p>
                  )}
                </div>
                {c.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    onClick={() => sendMutation.mutate(c.id)}
                    loading={sendMutation.isPending}
                  >
                    <Send size={12} /> Send Now
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CampaignFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(body) => createMutation.mutate(body)}
        loading={createMutation.isPending}
      />
    </div>
  )
}

function CampaignFormDialog({
  open,
  onClose,
  onSave,
  loading,
}: {
  open: boolean
  onClose: () => void
  onSave: (body: object) => void
  loading: boolean
}) {
  const [form, setForm] = useState({
    name: '',
    channel: 'EMAIL',
    segment: 'ALL',
    subject: '',
    body: '',
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Campaign Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Feb Promo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Channel *</Label>
              <select
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="PUSH">Push</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Segment *</Label>
              <select
                value={form.segment}
                onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              >
                {SEGMENTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
          {form.channel === 'EMAIL' && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Special offer just for you!" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Message Body *</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Hello {name}, enjoy a special offer today…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={() => onSave(form)} loading={loading}>
            Save Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tab 6: Reviews ────────────────────────────────────────────────────────────

function ReviewsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'pending' | 'approved'>('pending')

  const { data, isLoading } = useQuery({
    queryKey: ['crm', 'reviews', restaurantId, filter],
    queryFn: () =>
      crmApi.listReviews(restaurantId, {
        isApproved: filter === 'approved',
        limit: 50,
      }),
    enabled: !!restaurantId,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['crm', 'reviews', restaurantId] })

  const approveMutation = useMutation({
    mutationFn: (id: string) => crmApi.approveReview(restaurantId, id),
    onSuccess: () => { toast.success('Review approved'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => crmApi.rejectReview(restaurantId, id),
    onSuccess: () => { toast.success('Review deleted'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const reviews = data?.reviews ?? []

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['pending', 'approved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filter === f
                ? 'bg-brand text-white border-brand'
                : 'bg-white border-border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f === 'pending' ? 'Pending' : 'Approved'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : reviews.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">No {filter} reviews</div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {r.customer.firstName} {r.customer.lastName ?? ''}
                    </p>
                    <StarRating rating={r.rating} />
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                  {r.customer.phone && (
                    <p className="text-xs text-gray-400 mt-1">{r.customer.phone}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!r.isApproved && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:bg-green-50"
                      onClick={() => approveMutation.mutate(r.id)}
                      loading={approveMutation.isPending}
                    >
                      <Check size={12} /> Approve
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => rejectMutation.mutate(r.id)}
                    loading={rejectMutation.isPending}
                  >
                    <X size={12} /> Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main CRM Page ─────────────────────────────────────────────────────────────

type CRMTab = 'customers' | 'loyalty' | 'stamps' | 'promos' | 'campaigns' | 'reviews'

const TABS: Array<{ id: CRMTab; label: string; icon: React.ElementType }> = [
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'loyalty', label: 'Loyalty', icon: Star },
  { id: 'stamps', label: 'Stamp Cards', icon: Stamp },
  { id: 'promos', label: 'Promo Codes', icon: Tag },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'reviews', label: 'Reviews', icon: MessageSquare },
]

export default function CRMPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [activeTab, setActiveTab] = useState<CRMTab>('customers')

  if (!restaurantId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No restaurant linked to your account.
      </div>
    )
  }

  return (
    <PageShell title="CRM & Loyalty">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'customers' && <CustomersTab restaurantId={restaurantId} />}
      {activeTab === 'loyalty' && <LoyaltyTab restaurantId={restaurantId} />}
      {activeTab === 'stamps' && <StampCardsTab restaurantId={restaurantId} />}
      {activeTab === 'promos' && <PromoCodesTab restaurantId={restaurantId} />}
      {activeTab === 'campaigns' && <CampaignsTab restaurantId={restaurantId} />}
      {activeTab === 'reviews' && <ReviewsTab restaurantId={restaurantId} />}
    </PageShell>
  )
}
