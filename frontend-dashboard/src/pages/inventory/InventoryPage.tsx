import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Building2,
  ShoppingCart,
  BarChart3,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { inventoryApi } from '@/lib/inventory.api'
import { menuApi } from '@/lib/menu.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import type {
  Ingredient,
  Supplier,
  PurchaseOrder,
  POStatus,
  UnitType,
  StockMovement,
  MovementType,
} from '@/types/inventory.types'

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = 'ingredients' | 'recipes' | 'suppliers' | 'purchase-orders' | 'stock' | 'reports'

const UNIT_TYPES: UnitType[] = ['KG', 'G', 'L', 'ML', 'PIECE', 'DOZEN', 'BOX', 'PACK']

const WASTE_REASONS = ['SPOILAGE', 'OVERCOOKED', 'DROPPED', 'EXPIRED', 'OTHER']

const PO_STATUS_COLORS: Record<POStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  PARTIAL: 'bg-yellow-100 text-yellow-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const MOVEMENT_TYPE_COLORS: Record<MovementType, string> = {
  PURCHASE: 'bg-green-100 text-green-700',
  SALE: 'bg-blue-100 text-blue-700',
  WASTE: 'bg-red-100 text-red-700',
  ADJUSTMENT: 'bg-purple-100 text-purple-700',
  STOCKTAKE: 'bg-yellow-100 text-yellow-700',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StockBadge({ current, threshold }: { current: number; threshold: number }) {
  const isLow = threshold > 0 && current <= threshold
  return (
    <span className={cn('font-semibold', isLow ? 'text-red-600' : 'text-gray-900')}>
      {current.toFixed(2)}
      {isLow && <AlertTriangle className="inline ml-1 w-3 h-3 text-red-500" />}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InventoryPage() {
  const restaurantId = useAuthStore((s) => s.restaurantId) ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('ingredients')
  const qc = useQueryClient()

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'ingredients', label: 'Ingredients', icon: Package },
    { key: 'recipes', label: 'Recipes', icon: BookOpen },
    { key: 'suppliers', label: 'Suppliers', icon: Building2 },
    { key: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { key: 'stock', label: 'Stock', icon: RefreshCw },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
  ]

  return (
    <PageShell title="Inventory">
      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === t.key
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ingredients'     && <IngredientsTab restaurantId={restaurantId} qc={qc} />}
      {activeTab === 'recipes'         && <RecipesTab restaurantId={restaurantId} qc={qc} />}
      {activeTab === 'suppliers'       && <SuppliersTab restaurantId={restaurantId} qc={qc} />}
      {activeTab === 'purchase-orders' && <PurchaseOrdersTab restaurantId={restaurantId} qc={qc} />}
      {activeTab === 'stock'           && <StockTab restaurantId={restaurantId} qc={qc} />}
      {activeTab === 'reports'         && <ReportsTab restaurantId={restaurantId} />}
    </PageShell>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 1 — Ingredients
// ═══════════════════════════════════════════════════════════════════════════════

function IngredientsTab({ restaurantId, qc }: { restaurantId: string; qc: any }) {
  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Ingredient | null>(null)
  const [form, setForm] = useState({
    name: '', unit: 'KG' as UnitType, category: '',
    currentStock: '0', lowStockThreshold: '0', costPerUnit: '0',
  })

  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'ingredients', search, lowStockOnly],
    queryFn: () => inventoryApi.listIngredients(restaurantId, {
      search: search || undefined,
      lowStockOnly: lowStockOnly ? 'true' : undefined,
    }),
    enabled: !!restaurantId,
  })

  const createMut = useMutation({
    mutationFn: (body: any) => inventoryApi.createIngredient(restaurantId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'ingredients'] }); setShowDialog(false); toast.success('Ingredient created') },
    onError: (e) => toast.error(apiError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => inventoryApi.updateIngredient(restaurantId, id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'ingredients'] }); setShowDialog(false); toast.success('Ingredient updated') },
    onError: (e) => toast.error(apiError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteIngredient(restaurantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'ingredients'] }); toast.success('Ingredient deleted') },
    onError: (e) => toast.error(apiError(e)),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', unit: 'KG', category: '', currentStock: '0', lowStockThreshold: '0', costPerUnit: '0' })
    setShowDialog(true)
  }

  function openEdit(ing: Ingredient) {
    setEditing(ing)
    setForm({
      name: ing.name, unit: ing.unit, category: ing.category ?? '',
      currentStock: String(ing.currentStock), lowStockThreshold: String(ing.lowStockThreshold),
      costPerUnit: String(ing.costPerUnit),
    })
    setShowDialog(true)
  }

  function handleSubmit() {
    const body = {
      name: form.name, unit: form.unit, category: form.category || undefined,
      currentStock: parseFloat(form.currentStock) || 0,
      lowStockThreshold: parseFloat(form.lowStockThreshold) || 0,
      costPerUnit: parseFloat(form.costPerUnit) || 0,
    }
    if (editing) updateMut.mutate({ id: editing.id, body })
    else createMut.mutate(body)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search ingredients…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
        <Button size="sm" onClick={openCreate} className="ml-auto gap-1">
          <Plus className="w-4 h-4" /> Add Ingredient
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Threshold</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Cost/Unit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">Loading…</td></tr>
              ) : ingredients.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-gray-400">No ingredients found</td></tr>
              ) : ingredients.map((ing) => (
                <tr key={ing.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{ing.name}</td>
                  <td className="px-4 py-3 text-gray-500">{ing.category ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <StockBadge current={ing.currentStock} threshold={ing.lowStockThreshold} />
                  </td>
                  <td className="px-4 py-3">{ing.unit}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{ing.lowStockThreshold}</td>
                  <td className="px-4 py-3 text-right text-gray-500">৳{ing.costPerUnit.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">•••</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(ing)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm('Delete this ingredient?')) deleteMut.mutate(ing.id) }}>
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Ingredient' : 'Add Ingredient'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unit *</Label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as UnitType })}>
                  {UNIT_TYPES.map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Current Stock</Label>
                <Input type="number" min="0" step="0.01" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
              </div>
              <div>
                <Label>Low Threshold</Label>
                <Input type="number" min="0" step="0.01" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} />
              </div>
              <div>
                <Label>Cost/Unit (৳)</Label>
                <Input type="number" min="0" step="0.01" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={!form.name || createMut.isPending || updateMut.isPending}>
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 2 — Recipes
// ═══════════════════════════════════════════════════════════════════════════════

function RecipesTab({ restaurantId, qc }: { restaurantId: string; qc: any }) {
  const [selectedItemId, setSelectedItemId] = useState('')
  const [lines, setLines] = useState<{ ingredientId: string; quantity: string; unit: UnitType }[]>([])

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu', restaurantId, 'items'],
    queryFn: () => menuApi.listItems(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', restaurantId, 'ingredients'],
    queryFn: () => inventoryApi.listIngredients(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'recipe', selectedItemId],
    queryFn: () => inventoryApi.getRecipe(restaurantId, selectedItemId),
    enabled: !!selectedItemId,
    onSuccess: (data: any) => {
      setLines(data.items.map((ri: any) => ({
        ingredientId: ri.ingredientId,
        quantity: String(ri.quantity),
        unit: ri.unit,
      })))
    },
  })

  const saveMut = useMutation({
    mutationFn: () => inventoryApi.setRecipe(restaurantId, selectedItemId, {
      items: lines.map((l) => ({ ingredientId: l.ingredientId, quantity: parseFloat(l.quantity) || 0, unit: l.unit })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'recipe', selectedItemId] }); toast.success('Recipe saved') },
    onError: (e) => toast.error(apiError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: () => inventoryApi.deleteRecipe(restaurantId, selectedItemId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'recipe', selectedItemId] }); setLines([]); toast.success('Recipe cleared') },
    onError: (e) => toast.error(apiError(e)),
  })

  function handleItemChange(id: string) {
    setSelectedItemId(id)
    setLines([])
  }

  function addLine() {
    setLines([...lines, { ingredientId: '', quantity: '1', unit: 'KG' }])
  }

  function removeLine(i: number) {
    setLines(lines.filter((_, idx) => idx !== i))
  }

  function updateLine(i: number, field: string, val: string) {
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <Label>Select Menu Item</Label>
        <select
          className="w-full border rounded px-3 py-2 text-sm mt-1"
          value={selectedItemId}
          onChange={(e) => handleItemChange(e.target.value)}
        >
          <option value="">— choose a menu item —</option>
          {menuItems.map((item: any) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </div>

      {selectedItemId && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Recipe ingredients</h3>
              <div className="flex gap-2">
                {lines.length > 0 && (
                  <Button size="sm" variant="outline" className="text-red-600" onClick={() => { if (confirm('Clear recipe?')) deleteMut.mutate() }}>
                    Clear
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={addLine}><Plus className="w-3 h-3 mr-1" /> Add ingredient</Button>
              </div>
            </div>

            {recipeLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : lines.length === 0 ? (
              <p className="text-sm text-gray-400">No recipe set. Add ingredients above.</p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      className="flex-1 border rounded px-2 py-1.5 text-sm"
                      value={line.ingredientId}
                      onChange={(e) => updateLine(i, 'ingredientId', e.target.value)}
                    >
                      <option value="">— ingredient —</option>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name}</option>
                      ))}
                    </select>
                    <Input
                      type="number" min="0" step="0.001" className="w-24"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                    />
                    <select
                      className="border rounded px-2 py-1.5 text-sm"
                      value={line.unit}
                      onChange={(e) => updateLine(i, 'unit', e.target.value)}
                    >
                      {UNIT_TYPES.map((u) => <option key={u}>{u}</option>)}
                    </select>
                    <Button variant="ghost" size="sm" onClick={() => removeLine(i)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || lines.some((l) => !l.ingredientId)}>
                Save Recipe
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 3 — Suppliers
// ═══════════════════════════════════════════════════════════════════════════════

function SuppliersTab({ restaurantId, qc }: { restaurantId: string; qc: any }) {
  const [showDialog, setShowDialog] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' })

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'suppliers'],
    queryFn: () => inventoryApi.listSuppliers(restaurantId),
    enabled: !!restaurantId,
  })

  const createMut = useMutation({
    mutationFn: (body: any) => inventoryApi.createSupplier(restaurantId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'suppliers'] }); setShowDialog(false); toast.success('Supplier created') },
    onError: (e) => toast.error(apiError(e)),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => inventoryApi.updateSupplier(restaurantId, id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'suppliers'] }); setShowDialog(false); toast.success('Supplier updated') },
    onError: (e) => toast.error(apiError(e)),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteSupplier(restaurantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'suppliers'] }); toast.success('Supplier deleted') },
    onError: (e) => toast.error(apiError(e)),
  })

  function openCreate() {
    setEditing(null)
    setForm({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' })
    setShowDialog(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, contactName: s.contactName ?? '', phone: s.phone ?? '', email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '' })
    setShowDialog(true)
  }

  function handleSubmit() {
    const body = { name: form.name, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, notes: form.notes || undefined }
    if (editing) updateMut.mutate({ id: editing.id, body })
    else createMut.mutate(body)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={openCreate} className="gap-1"><Plus className="w-4 h-4" /> Add Supplier</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading…</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No suppliers yet</td></tr>
              ) : suppliers.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.contactName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">•••</Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(s)}><Pencil className="w-4 h-4 mr-2" />Edit</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm('Delete supplier?')) deleteMut.mutate(s.id) }}>
                          <Trash2 className="w-4 h-4 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Contact Name</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSubmit} disabled={!form.name || createMut.isPending || updateMut.isPending}>
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 4 — Purchase Orders
// ═══════════════════════════════════════════════════════════════════════════════

function PurchaseOrdersTab({ restaurantId, qc }: { restaurantId: string; qc: any }) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null)
  const [poItems, setPOItems] = useState<{ ingredientId: string; orderedQty: string; unitCost: string }[]>([{ ingredientId: '', orderedQty: '1', unitCost: '0' }])
  const [supplierId, setSupplierId] = useState('')

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'pos'],
    queryFn: () => inventoryApi.listPOs(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['inventory', restaurantId, 'suppliers'],
    queryFn: () => inventoryApi.listSuppliers(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', restaurantId, 'ingredients'],
    queryFn: () => inventoryApi.listIngredients(restaurantId),
    enabled: !!restaurantId,
  })

  const createMut = useMutation({
    mutationFn: (body: any) => inventoryApi.createPO(restaurantId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'pos'] }); setShowCreateDialog(false); toast.success('Purchase order created') },
    onError: (e) => toast.error(apiError(e)),
  })

  const receiveMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => inventoryApi.receivePO(restaurantId, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'pos'] })
      qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'ingredients'] })
      setReceivePO(null)
      toast.success('Stock received')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const cancelMut = useMutation({
    mutationFn: (id: string) => inventoryApi.cancelPO(restaurantId, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'pos'] }); toast.success('PO cancelled') },
    onError: (e) => toast.error(apiError(e)),
  })

  // Receive state
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({})

  function openReceive(po: PurchaseOrder) {
    const qtys: Record<string, string> = {}
    po.items.forEach((i) => { qtys[i.id] = String(i.orderedQty - i.receivedQty) })
    setReceiveQtys(qtys)
    setReceivePO(po)
  }

  function handleCreate() {
    createMut.mutate({
      supplierId: supplierId || undefined,
      items: poItems.map((i) => ({
        ingredientId: i.ingredientId,
        orderedQty: parseFloat(i.orderedQty) || 0,
        unitCost: parseFloat(i.unitCost) || 0,
      })),
    })
  }

  function handleReceive() {
    if (!receivePO) return
    receiveMut.mutate({
      id: receivePO.id,
      body: {
        items: receivePO.items.map((i) => ({
          purchaseOrderItemId: i.id,
          receivedQty: parseFloat(receiveQtys[i.id] ?? '0') || 0,
        })).filter((i) => i.receivedQty > 0),
      },
    })
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1"><Plus className="w-4 h-4" /> Create PO</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">PO Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Supplier</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Items</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading…</td></tr>
              ) : pos.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-400">No purchase orders</td></tr>
              ) : pos.map((po) => (
                <tr key={po.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">{formatDate(po.orderDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{po.supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', PO_STATUS_COLORS[po.status])}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">৳{po.totalAmount.toFixed(0)}</td>
                  <td className="px-4 py-3 text-gray-500">{(po.items as any[]).length} items</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="sm">•••</Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {['DRAFT', 'SENT', 'PARTIAL'].includes(po.status) && (
                          <DropdownMenuItem onClick={() => openReceive(po)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" />Receive Stock
                          </DropdownMenuItem>
                        )}
                        {['DRAFT', 'SENT'].includes(po.status) && (
                          <DropdownMenuItem className="text-red-600" onClick={() => { if (confirm('Cancel this PO?')) cancelMut.mutate(po.id) }}>
                            <XCircle className="w-4 h-4 mr-2" />Cancel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Create PO dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Purchase Order</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Supplier</Label>
              <select className="w-full border rounded px-3 py-2 text-sm mt-1" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— no supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button size="sm" variant="outline" onClick={() => setPOItems([...poItems, { ingredientId: '', orderedQty: '1', unitCost: '0' }])}>
                  <Plus className="w-3 h-3 mr-1" />Add
                </Button>
              </div>
              <div className="space-y-2">
                {poItems.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <select className="flex-1 border rounded px-2 py-1.5 text-sm" value={item.ingredientId} onChange={(e) => setPOItems(poItems.map((x, idx) => idx === i ? { ...x, ingredientId: e.target.value } : x))}>
                      <option value="">— ingredient —</option>
                      {ingredients.map((ing) => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                    </select>
                    <Input type="number" placeholder="Qty" className="w-20" value={item.orderedQty} onChange={(e) => setPOItems(poItems.map((x, idx) => idx === i ? { ...x, orderedQty: e.target.value } : x))} />
                    <Input type="number" placeholder="Cost" className="w-24" value={item.unitCost} onChange={(e) => setPOItems(poItems.map((x, idx) => idx === i ? { ...x, unitCost: e.target.value } : x))} />
                    <Button variant="ghost" size="sm" onClick={() => setPOItems(poItems.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Total: ৳{poItems.reduce((s, i) => s + (parseFloat(i.orderedQty) || 0) * (parseFloat(i.unitCost) || 0), 0).toFixed(2)}</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleCreate} disabled={createMut.isPending || poItems.some((i) => !i.ingredientId)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive stock dialog */}
      {receivePO && (
        <Dialog open={!!receivePO} onOpenChange={() => setReceivePO(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Receive Stock — PO {formatDate(receivePO.orderDate)}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {receivePO.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm">{item.ingredient?.name ?? item.ingredientId}</span>
                  <span className="text-xs text-gray-400">ordered {item.orderedQty}, received {item.receivedQty}</span>
                  <Input
                    type="number" min="0" step="0.01" className="w-24"
                    value={receiveQtys[item.id] ?? ''}
                    onChange={(e) => setReceiveQtys({ ...receiveQtys, [item.id]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={handleReceive} disabled={receiveMut.isPending}>Receive</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 5 — Stock
// ═══════════════════════════════════════════════════════════════════════════════

function StockTab({ restaurantId, qc }: { restaurantId: string; qc: any }) {
  const [showWaste, setShowWaste] = useState(false)
  const [showTake, setShowTake] = useState(false)
  const [wasteForm, setWasteForm] = useState({ ingredientId: '', quantity: '1', reason: 'SPOILAGE', notes: '' })
  const [takeCounts, setTakeCounts] = useState<Record<string, string>>({})

  const { data: movements, isLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'movements'],
    queryFn: () => inventoryApi.listMovements(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: ingredients = [] } = useQuery({
    queryKey: ['inventory', restaurantId, 'ingredients'],
    queryFn: () => inventoryApi.listIngredients(restaurantId),
    enabled: !!restaurantId,
  })

  const wasteMut = useMutation({
    mutationFn: (body: any) => inventoryApi.logWaste(restaurantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'movements'] })
      qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'ingredients'] })
      setShowWaste(false)
      toast.success('Waste logged')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  const takeMut = useMutation({
    mutationFn: (body: any) => inventoryApi.stockTake(restaurantId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'movements'] })
      qc.invalidateQueries({ queryKey: ['inventory', restaurantId, 'ingredients'] })
      setShowTake(false)
      toast.success('Stock take completed')
    },
    onError: (e) => toast.error(apiError(e)),
  })

  function openTake() {
    const counts: Record<string, string> = {}
    ingredients.forEach((i) => { counts[i.id] = String(i.currentStock) })
    setTakeCounts(counts)
    setShowTake(true)
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <Button size="sm" variant="outline" onClick={() => setShowWaste(true)} className="gap-1">
          <Trash2 className="w-4 h-4" /> Log Waste
        </Button>
        <Button size="sm" variant="outline" onClick={openTake} className="gap-1">
          <RefreshCw className="w-4 h-4" /> Conduct Stock Take
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ingredient</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading…</td></tr>
              ) : !movements?.movements?.length ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No stock movements</td></tr>
              ) : movements.movements.map((mv) => (
                <tr key={mv.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{mv.ingredient.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', MOVEMENT_TYPE_COLORS[mv.type])}>
                      {mv.type}
                    </span>
                  </td>
                  <td className={cn('px-4 py-3 text-right font-medium', mv.quantity >= 0 ? 'text-green-600' : 'text-red-600')}>
                    {mv.quantity >= 0 ? '+' : ''}{mv.quantity.toFixed(3)} {mv.ingredient.unit}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{mv.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(mv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Waste dialog */}
      <Dialog open={showWaste} onOpenChange={setShowWaste}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log Waste</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Ingredient *</Label>
              <select className="w-full border rounded px-3 py-2 text-sm mt-1" value={wasteForm.ingredientId} onChange={(e) => setWasteForm({ ...wasteForm, ingredientId: e.target.value })}>
                <option value="">— select —</option>
                {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.currentStock.toFixed(2)} {i.unit})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity *</Label><Input type="number" min="0.001" step="0.001" value={wasteForm.quantity} onChange={(e) => setWasteForm({ ...wasteForm, quantity: e.target.value })} /></div>
              <div>
                <Label>Reason *</Label>
                <select className="w-full border rounded px-3 py-2 text-sm mt-1" value={wasteForm.reason} onChange={(e) => setWasteForm({ ...wasteForm, reason: e.target.value })}>
                  {WASTE_REASONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea rows={2} value={wasteForm.notes} onChange={(e) => setWasteForm({ ...wasteForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => wasteMut.mutate({ ingredientId: wasteForm.ingredientId, quantity: parseFloat(wasteForm.quantity), reason: wasteForm.reason, notes: wasteForm.notes || undefined })} disabled={!wasteForm.ingredientId || wasteMut.isPending}>Log Waste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock take dialog */}
      <Dialog open={showTake} onOpenChange={setShowTake}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Conduct Stock Take</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 mb-3">Enter the actual physical count for each ingredient.</p>
          <div className="space-y-2">
            {ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center gap-3">
                <span className="flex-1 text-sm">{ing.name} <span className="text-gray-400">({ing.unit})</span></span>
                <span className="text-xs text-gray-400 w-20 text-right">System: {ing.currentStock.toFixed(2)}</span>
                <Input
                  type="number" min="0" step="0.001" className="w-24"
                  value={takeCounts[ing.id] ?? ''}
                  onChange={(e) => setTakeCounts({ ...takeCounts, [ing.id]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={() => takeMut.mutate({ counts: ingredients.map((i) => ({ ingredientId: i.id, physicalCount: parseFloat(takeCounts[i.id] ?? String(i.currentStock)) || 0 })) })} disabled={takeMut.isPending}>Save Stock Take</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB 6 — Reports
// ═══════════════════════════════════════════════════════════════════════════════

function ReportsTab({ restaurantId }: { restaurantId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const firstOfMonth = today.slice(0, 8) + '01'
  const [dateFrom, setDateFrom] = useState(firstOfMonth)
  const [dateTo, setDateTo] = useState(today)
  const [applied, setApplied] = useState({ dateFrom: firstOfMonth, dateTo: today })

  const { data: foodCost, isLoading: fcLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'food-cost', applied.dateFrom, applied.dateTo],
    queryFn: () => inventoryApi.foodCostReport(restaurantId, { dateFrom: applied.dateFrom, dateTo: applied.dateTo }),
    enabled: !!restaurantId,
  })

  const { data: variance = [], isLoading: varLoading } = useQuery({
    queryKey: ['inventory', restaurantId, 'variance', applied.dateFrom, applied.dateTo],
    queryFn: () => inventoryApi.varianceReport(restaurantId, { dateFrom: applied.dateFrom, dateTo: applied.dateTo }),
    enabled: !!restaurantId,
  })

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex items-end gap-3">
        <div><Label>From</Label><Input type="date" className="mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><Label>To</Label><Input type="date" className="mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <Button onClick={() => setApplied({ dateFrom, dateTo })}>Apply</Button>
      </div>

      {/* Food cost summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: `৳${(foodCost?.totalRevenue ?? 0).toLocaleString()}`, loading: fcLoading },
          { label: 'Total COGS', value: `৳${(foodCost?.totalCogs ?? 0).toLocaleString()}`, loading: fcLoading },
          { label: 'Food Cost %', value: `${(foodCost?.foodCostPct ?? 0).toFixed(1)}%`, loading: fcLoading, highlight: true },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
              <p className={cn('text-2xl font-bold', kpi.highlight ? 'text-brand' : 'text-gray-900')}>
                {kpi.loading ? '…' : kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ingredient cost breakdown */}
      {foodCost && foodCost.byIngredient.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h3 className="font-medium text-sm">Cost by Ingredient</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Ingredient</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Used Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total Cost</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">% of COGS</th>
                </tr>
              </thead>
              <tbody>
                {foodCost.byIngredient.map((row) => (
                  <tr key={row.ingredientId} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">{row.name} <span className="text-gray-400 text-xs">({row.unit})</span></td>
                    <td className="px-4 py-3 text-right">{row.totalUsedQty.toFixed(3)}</td>
                    <td className="px-4 py-3 text-right">৳{row.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{row.costPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Usage variance */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-sm">Usage Variance (Theoretical vs Actual)</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ingredient</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Theoretical</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actual</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Variance</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Variance %</th>
              </tr>
            </thead>
            <tbody>
              {varLoading ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">Loading…</td></tr>
              ) : variance.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-400">No data for selected period</td></tr>
              ) : variance.map((row) => (
                <tr key={row.ingredientId} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">{row.name} <span className="text-gray-400 text-xs">({row.unit})</span></td>
                  <td className="px-4 py-3 text-right">{row.theoreticalQty.toFixed(3)}</td>
                  <td className="px-4 py-3 text-right">{row.actualQty.toFixed(3)}</td>
                  <td className={cn('px-4 py-3 text-right font-medium', row.variance > 0 ? 'text-red-600' : row.variance < 0 ? 'text-green-600' : 'text-gray-600')}>
                    {row.variance > 0 ? '+' : ''}{row.variance.toFixed(3)}
                  </td>
                  <td className={cn('px-4 py-3 text-right', Math.abs(row.variancePct) > 10 ? 'text-red-600 font-medium' : 'text-gray-600')}>
                    {row.variancePct > 0 ? '+' : ''}{row.variancePct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
