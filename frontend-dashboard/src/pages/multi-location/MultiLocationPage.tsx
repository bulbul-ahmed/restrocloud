import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { multiLocationApi } from '@/lib/multi-location.api'
import { inventoryApi } from '@/lib/inventory.api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Location, StockTransfer, TenantStaff } from '@/types/multi-location.types'
import { Building2, MapPin, Users, ArrowRightLeft, BarChart3, TrendingUp, Package, CheckCircle, XCircle, Clock } from 'lucide-react'

type Tab = 'locations' | 'dashboard' | 'overrides' | 'transfers' | 'staff'

// ─── Status badge helpers ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-500/15 text-yellow-600',
    RECEIVED: 'bg-green-500/15 text-green-600',
    CANCELLED: 'bg-red-500/15 text-red-500',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status] ?? 'bg-gray-200 text-gray-600'}`}>
      {status}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    OWNER: 'bg-purple-500/15 text-purple-600',
    MANAGER: 'bg-blue-500/15 text-blue-600',
    STAFF: 'bg-gray-200 text-gray-600',
    CASHIER: 'bg-orange-500/15 text-orange-600',
    WAITER: 'bg-cyan-500/15 text-cyan-600',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[role] ?? 'bg-gray-200 text-gray-600'}`}>
      {role}
    </span>
  )
}

// ─── Create Location Dialog ───────────────────────────────────────────────────

function CreateLocationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', slug: '', description: '', phone: '', email: '', address: '', city: '', timezone: 'Asia/Dhaka' })
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const mutation = useMutation({
    mutationFn: () => multiLocationApi.createLocation(form),
    onSuccess: () => {
      toast.success('Location created')
      qc.invalidateQueries({ queryKey: ['locations'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create location'),
  })

  // Auto-generate slug from name
  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Location</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => { f('name')(e); setForm((p) => ({ ...p, slug: autoSlug(e.target.value) })) }} placeholder="Dhanmondi Branch" />
            </div>
            <div>
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={f('slug')} placeholder="dhanmondi-branch" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input value={form.phone} onChange={f('phone')} placeholder="+880..." /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={f('email')} type="email" /></div>
          </div>
          <div><Label>Address</Label><Input value={form.address} onChange={f('address')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>City</Label><Input value={form.city} onChange={f('city')} placeholder="Dhaka" /></div>
            <div><Label>Timezone</Label><Input value={form.timezone} onChange={f('timezone')} /></div>
          </div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={f('description')} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.name || !form.slug || mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create Stock Transfer Dialog ─────────────────────────────────────────────

function CreateTransferDialog({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: Location[] }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ fromRestaurantId: '', toRestaurantId: '', ingredientId: '', quantity: '', notes: '' })
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }))

  const { data: ingredients } = useQuery({
    queryKey: ['inventory-ingredients', form.fromRestaurantId],
    queryFn: () => inventoryApi.listIngredients(form.fromRestaurantId),
    enabled: !!form.fromRestaurantId,
  })

  const ingList = Array.isArray(ingredients) ? ingredients : []

  const mutation = useMutation({
    mutationFn: () => multiLocationApi.createStockTransfer({
      fromRestaurantId: form.fromRestaurantId,
      toRestaurantId: form.toRestaurantId,
      ingredientId: form.ingredientId,
      quantity: parseFloat(form.quantity),
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Transfer initiated')
      qc.invalidateQueries({ queryKey: ['transfers'] })
      onClose()
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Transfer failed'),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Initiate Stock Transfer</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From Location *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.fromRestaurantId} onChange={f('fromRestaurantId')}>
                <option value="">— select —</option>
                {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div>
              <Label>To Location *</Label>
              <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.toRestaurantId} onChange={f('toRestaurantId')}>
                <option value="">— select —</option>
                {locations.filter(l => l.isActive && l.id !== form.fromRestaurantId).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Ingredient *</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.ingredientId} onChange={f('ingredientId')} disabled={!form.fromRestaurantId}>
              <option value="">— select ingredient —</option>
              {ingList.map((i: any) => <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit} available)</option>)}
            </select>
          </div>
          <div><Label>Quantity *</Label><Input type="number" min="0.001" step="0.001" value={form.quantity} onChange={f('quantity')} /></div>
          <div><Label>Notes</Label><Textarea value={form.notes} onChange={f('notes')} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.fromRestaurantId || !form.toRestaurantId || !form.ingredientId || !form.quantity || mutation.isPending}>
            {mutation.isPending ? 'Initiating…' : 'Initiate Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function LocationsTab({ locations, loading }: { locations: Location[]; loading: boolean }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? multiLocationApi.activateLocation(id) : multiLocationApi.deactivateLocation(id),
    onSuccess: () => { toast.success('Location updated'); qc.invalidateQueries({ queryKey: ['locations'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{locations.length} location{locations.length !== 1 ? 's' : ''} in your account</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>+ Add Location</Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc) => (
            <div key={loc.id} className={`border rounded-xl p-5 space-y-3 ${loc.isActive ? 'bg-card' : 'bg-muted/30 opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-base">{loc.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{loc.slug}</p>
                </div>
                <Badge variant={loc.isActive ? 'default' : 'secondary'} className="shrink-0">
                  {loc.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              {loc.address && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {loc.address}{loc.city ? `, ${loc.city}` : ''}
                </p>
              )}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>📋 {loc._count.orders} orders</span>
                <span>👥 {loc._count.users} staff</span>
              </div>
              <Button
                size="sm"
                variant={loc.isActive ? 'outline' : 'default'}
                className="w-full"
                onClick={() => toggleMut.mutate({ id: loc.id, active: !loc.isActive })}
                disabled={toggleMut.isPending}
              >
                {loc.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ))}
        </div>
      )}

      <CreateLocationDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

function DashboardTab() {
  const { data: consolidated, isLoading } = useQuery({
    queryKey: ['consolidated'],
    queryFn: () => multiLocationApi.getConsolidated(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const { data: comparison } = useQuery({
    queryKey: ['comparison'],
    queryFn: () => multiLocationApi.getComparison(),
  })

  const locations = consolidated?.locations ?? []
  const leaderboard = Array.isArray(comparison) ? comparison : []

  return (
    <div className="space-y-6">
      {/* Consolidated KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue Today', value: consolidated ? `৳${consolidated.totalRevenue.toFixed(2)}` : '—', icon: TrendingUp },
          { label: 'Total Orders Today', value: consolidated?.totalOrders ?? '—', icon: BarChart3 },
          { label: 'Avg Order Value', value: consolidated ? `৳${consolidated.avgOrderValue.toFixed(2)}` : '—', icon: BarChart3 },
          { label: 'Active Locations', value: consolidated?.locationCount ?? '—', icon: Building2 },
        ].map((kpi) => (
          <div key={kpi.label} className="border rounded-xl p-4 bg-card">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold">{isLoading ? '…' : kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Today by location */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Today's Revenue by Location</h3>
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-2">Location</th>
                <th className="text-right px-4 py-2">Orders</th>
                <th className="text-right px-4 py-2">Revenue</th>
                <th className="text-right px-4 py-2">Avg Ticket</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc, i) => (
                <tr key={loc.restaurantId} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                  <td className="px-4 py-2 font-medium">{loc.name}</td>
                  <td className="px-4 py-2 text-right">{loc.todayOrders}</td>
                  <td className="px-4 py-2 text-right font-semibold">৳{loc.todayRevenue.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">৳{loc.avgOrderValue.toFixed(2)}</td>
                </tr>
              ))}
              {locations.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No data for today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 30-day leaderboard */}
      {leaderboard.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">30-Day Location Leaderboard</h3>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2">Rank</th>
                  <th className="text-left px-4 py-2">Location</th>
                  <th className="text-right px-4 py-2">Revenue</th>
                  <th className="text-right px-4 py-2">Orders</th>
                  <th className="text-right px-4 py-2">Customers</th>
                  <th className="text-right px-4 py-2">Staff</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((loc, i) => (
                  <tr key={loc.restaurantId} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                    <td className="px-4 py-2">
                      <span className={`font-bold ${loc.rank === 1 ? 'text-yellow-500' : loc.rank === 2 ? 'text-gray-400' : loc.rank === 3 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                        #{loc.rank}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-medium">{loc.name}{loc.city ? <span className="text-muted-foreground text-xs ml-1">{loc.city}</span> : null}</td>
                    <td className="px-4 py-2 text-right font-semibold">৳{loc.revenue.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{loc.orders}</td>
                    <td className="px-4 py-2 text-right">{loc.customers}</td>
                    <td className="px-4 py-2 text-right">{loc.staff}</td>
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

function PriceOverridesTab({ locations }: { locations: Location[] }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ restaurantId: '', itemId: '', price: '' })

  const { data: overrides = [] } = useQuery({
    queryKey: ['price-overrides'],
    queryFn: () => multiLocationApi.listPriceOverrides(),
  })

  const setMut = useMutation({
    mutationFn: () => multiLocationApi.setPriceOverride({ restaurantId: form.restaurantId, itemId: form.itemId.trim(), price: parseFloat(form.price) }),
    onSuccess: () => { toast.success('Price override saved'); qc.invalidateQueries({ queryKey: ['price-overrides'] }); setForm({ restaurantId: '', itemId: '', price: '' }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => multiLocationApi.deletePriceOverride(id),
    onSuccess: () => { toast.success('Override removed'); qc.invalidateQueries({ queryKey: ['price-overrides'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const locMap = new Map(locations.map(l => [l.id, l.name]))

  return (
    <div className="space-y-6">
      {/* Set override form */}
      <div className="border rounded-xl p-5 bg-card space-y-4">
        <h3 className="font-semibold text-sm">Set Price Override</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Location</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.restaurantId} onChange={e => setForm(p => ({ ...p, restaurantId: e.target.value }))}>
              <option value="">— select —</option>
              {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Item ID</Label>
            <Input value={form.itemId} onChange={e => setForm(p => ({ ...p, itemId: e.target.value }))} placeholder="UUID or item ID" />
          </div>
          <div>
            <Label>Override Price (৳)</Label>
            <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))} placeholder="299.00" />
          </div>
        </div>
        <Button size="sm" onClick={() => setMut.mutate()} disabled={!form.restaurantId || !form.itemId || !form.price || setMut.isPending}>
          {setMut.isPending ? 'Saving…' : 'Save Override'}
        </Button>
      </div>

      {/* Existing overrides */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Active Overrides</h3>
        {(Array.isArray(overrides) ? overrides : []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No price overrides set. Base menu prices apply to all locations.</p>
        ) : (
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2">Location</th>
                  <th className="text-left px-4 py-2">Item ID</th>
                  <th className="text-right px-4 py-2">Override Price</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(overrides) ? overrides : []).map((ov, i) => (
                  <tr key={ov.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                    <td className="px-4 py-2">{locMap.get(ov.restaurantId) ?? ov.restaurantId.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{ov.itemId.slice(0, 20)}…</td>
                    <td className="px-4 py-2 text-right font-semibold">৳{parseFloat(ov.price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMut.mutate(ov.id)}>Remove</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StockTransfersTab({ locations }: { locations: Location[] }) {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [filterRid, setFilterRid] = useState('')

  const { data: transfers = [] } = useQuery({
    queryKey: ['transfers', filterRid],
    queryFn: () => multiLocationApi.listStockTransfers(filterRid ? { restaurantId: filterRid } : {}),
  })

  const receiveMut = useMutation({
    mutationFn: (id: string) => multiLocationApi.receiveStockTransfer(id),
    onSuccess: () => { toast.success('Transfer received'); qc.invalidateQueries({ queryKey: ['transfers'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => multiLocationApi.cancelStockTransfer(id),
    onSuccess: () => { toast.success('Transfer cancelled'); qc.invalidateQueries({ queryKey: ['transfers'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const list: StockTransfer[] = Array.isArray(transfers) ? transfers : []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="border rounded-md px-3 py-2 text-sm bg-background" value={filterRid} onChange={e => setFilterRid(e.target.value)}>
          <option value="">All Locations</option>
          {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <Button size="sm" onClick={() => setShowCreate(true)}>+ New Transfer</Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2">From → To</th>
              <th className="text-left px-4 py-2">Ingredient</th>
              <th className="text-right px-4 py-2">Qty</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t, i) => (
              <tr key={t.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                <td className="px-4 py-2">
                  <span className="font-medium">{t.fromName}</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="font-medium">{t.toName}</span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{t.ingredient?.name ?? t.ingredientId.slice(0, 8)}</td>
                <td className="px-4 py-2 text-right font-mono">{t.quantity} {t.ingredient?.unit ?? ''}</td>
                <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-right space-x-1">
                  {t.status === 'PENDING' && (
                    <>
                      <Button size="sm" variant="ghost" className="text-green-600 hover:text-green-700 h-7" onClick={() => receiveMut.mutate(t.id)} disabled={receiveMut.isPending}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />Receive
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7" onClick={() => cancelMut.mutate(t.id)} disabled={cancelMut.isPending}>
                        <XCircle className="h-3.5 w-3.5 mr-1" />Cancel
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No transfers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <CreateTransferDialog open={showCreate} onClose={() => setShowCreate(false)} locations={locations} />
    </div>
  )
}

function StaffTab({ locations }: { locations: Location[] }) {
  const qc = useQueryClient()

  const { data: staff = [] } = useQuery({
    queryKey: ['tenant-staff'],
    queryFn: () => multiLocationApi.getAllStaff(),
  })

  const assignMut = useMutation({
    mutationFn: ({ userId, restaurantId }: { userId: string; restaurantId: string }) =>
      multiLocationApi.assignStaffToLocation(userId, restaurantId),
    onSuccess: () => { toast.success('Staff reassigned'); qc.invalidateQueries({ queryKey: ['tenant-staff'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed'),
  })

  const members: TenantStaff[] = Array.isArray(staff) ? staff : []

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">{members.length} staff member{members.length !== 1 ? 's' : ''} across all locations</p>
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Role</th>
              <th className="text-left px-4 py-2">Current Location</th>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-right px-4 py-2">Assign To</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                <td className="px-4 py-2 font-medium">{m.firstName} {m.lastName}</td>
                <td className="px-4 py-2"><RoleBadge role={m.role} /></td>
                <td className="px-4 py-2 text-muted-foreground">{m.restaurantName ?? '—'}</td>
                <td className="px-4 py-2 text-muted-foreground text-xs">{m.email ?? m.phone ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <select
                    className="border rounded px-2 py-1 text-xs bg-background"
                    value={m.restaurantId ?? ''}
                    onChange={e => assignMut.mutate({ userId: m.id, restaurantId: e.target.value })}
                  >
                    <option value="" disabled>— move to —</option>
                    {locations.filter(l => l.isActive).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No staff found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MultiLocationPage() {
  const [tab, setTab] = useState<Tab>('locations')

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => multiLocationApi.listLocations(),
  })

  const locList: Location[] = Array.isArray(locations) ? locations : []

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'locations', label: 'Locations', icon: Building2 },
    { key: 'dashboard', label: 'Consolidated', icon: BarChart3 },
    { key: 'overrides', label: 'Price Overrides', icon: Package },
    { key: 'transfers', label: 'Stock Transfers', icon: ArrowRightLeft },
    { key: 'staff', label: 'All Staff', icon: Users },
  ]

  return (
    <PageShell
      title="Multi-Location"
      description={`${locList.length} location${locList.length !== 1 ? 's' : ''} in your account`}
    >
      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'locations' && <LocationsTab locations={locList} loading={isLoading} />}
      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'overrides' && <PriceOverridesTab locations={locList} />}
      {tab === 'transfers' && <StockTransfersTab locations={locList} />}
      {tab === 'staff' && <StaffTab locations={locList} />}
    </PageShell>
  )
}
