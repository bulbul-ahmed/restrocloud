import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  X,
  Upload,
  UtensilsCrossed,
  Settings2,
  Leaf,
  Link2,
  Pencil,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

import { menuApi } from '@/lib/menu.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency, cn } from '@/lib/utils'
import type {
  MenuItem,
  ModifierGroup,
  Modifier,
  CreateMenuItemDto,
  CreateModifierGroupDto,
  CreateModifierDto,
  UpdateModifierGroupDto,
} from '@/types/menu.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(adj: string | number | null | undefined) {
  const n = Number(adj ?? 0)
  if (n === 0) return 'free'
  return (n > 0 ? '+' : '') + formatCurrency(n)
}

function NativeSelect({
  value, onChange, options, placeholder, className,
}: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string; className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className ?? ''}`}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// ─── Item details form ────────────────────────────────────────────────────────

const itemSchema = z.object({
  name:            z.string().min(1, 'Name is required').max(200),
  categoryId:      z.string().min(1, 'Category is required'),
  price:           z.coerce.number().min(0, 'Price must be ≥ 0'),
  description:     z.string().max(1000).optional(),
  imageUrl:        z.string().optional().or(z.literal('')),
  isVeg:           z.boolean(),
  preparationTime: z.coerce.number().int().min(0).optional().nullable(),
  isAvailable:     z.boolean(),
})
type ItemForm = z.infer<typeof itemSchema>

function ItemDetailsCard({
  item, restaurantId, onSaved,
}: { item: MenuItem; restaurantId: string; onSaved: () => void }) {
  const qc = useQueryClient()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const { data: categories = [] } = useQuery({
    queryKey: ['menu', 'categories', restaurantId],
    queryFn: () => menuApi.listCategories(restaurantId),
    enabled: !!restaurantId,
  })

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isDirty } } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name:            item.name,
      categoryId:      item.categoryId,
      price:           Number(item.price),
      description:     item.description ?? '',
      imageUrl:        item.imageUrl ?? '',
      isVeg:           item.dietaryTags?.includes('vegetarian') ?? false,
      preparationTime: item.preparationTime ?? null,
      isAvailable:     item.isAvailable,
    },
  })

  useEffect(() => {
    reset({
      name:            item.name,
      categoryId:      item.categoryId,
      price:           Number(item.price),
      description:     item.description ?? '',
      imageUrl:        item.imageUrl ?? '',
      isVeg:           item.dietaryTags?.includes('vegetarian') ?? false,
      preparationTime: item.preparationTime ?? null,
      isAvailable:     item.isAvailable,
    })
  }, [item, reset])

  const imageUrl = watch('imageUrl')
  const isVeg = watch('isVeg')
  const isAvailable = watch('isAvailable')

  async function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Only image files are supported'); return }
    setUploading(true)
    try {
      const url = await menuApi.uploadImage(restaurantId, file)
      setValue('imageUrl', url, { shouldValidate: true, shouldDirty: true })
      toast.success('Image uploaded')
    } catch (e) { toast.error(apiError(e)) }
    finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const saveMutation = useMutation({
    mutationFn: (form: ItemForm) => {
      const tags = form.isVeg
        ? [...(item.dietaryTags?.filter(t => t !== 'vegetarian') ?? []), 'vegetarian']
        : (item.dietaryTags?.filter(t => t !== 'vegetarian') ?? [])
      const dto: Partial<CreateMenuItemDto> = {
        name:            form.name,
        categoryId:      form.categoryId,
        price:           form.price,
        description:     form.description || undefined,
        imageUrl:        form.imageUrl || undefined,
        isAvailable:     form.isAvailable,
        preparationTime: form.preparationTime || undefined,
        dietaryTags:     tags,
      }
      return menuApi.updateItem(restaurantId, item.id, dto)
    },
    onSuccess: () => {
      toast.success('Item saved')
      qc.invalidateQueries({ queryKey: ['menu', 'items', restaurantId] })
      qc.invalidateQueries({ queryKey: ['menu', 'item', restaurantId, item.id] })
      onSaved()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UtensilsCrossed size={16} className="text-gray-400" />
          Item Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => saveMutation.mutate(d))} className="space-y-5">
          {/* Image upload */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 block">Item Photo</Label>

            {/* Preview — shown when imageUrl is set */}
            {imageUrl && (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0">
                <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setValue('imageUrl', '', { shouldValidate: true, shouldDirty: true })}
                  className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            )}

            {/* Drop zone / upload button */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f) }}
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleImageFile(f) }}
              disabled={uploading}
              className={cn(
                'flex flex-col items-center gap-1 w-full justify-center px-3 py-4 border-2 border-dashed rounded-xl text-sm transition-colors disabled:opacity-50',
                dragOver ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-400 hover:border-brand hover:text-brand',
              )}
            >
              <Upload size={18} />
              <span>{uploading ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Click or drag & drop'}</span>
              <span className="text-xs text-gray-400">JPEG · PNG · WebP · GIF · max 5 MB</span>
            </button>
          </div>

          {/* Name */}
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Item Name *</Label>
            <Input {...register('name')} placeholder="e.g. Beef Burger" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">Category *</Label>
              <NativeSelect
                value={watch('categoryId')}
                onChange={(v) => setValue('categoryId', v, { shouldDirty: true })}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category"
              />
              {errors.categoryId && <p className="text-xs text-red-500 mt-1">{errors.categoryId.message}</p>}
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1 block">Price *</Label>
              <Input type="number" step="0.01" min="0" {...register('price')} placeholder="0.00" />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Description</Label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Short description shown to customers…"
              className="w-full border border-input rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>

          {/* Prep time + toggles */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2 min-w-[160px]">
              <Label className="text-xs font-medium text-gray-700 whitespace-nowrap">Prep time (min)</Label>
              <Input type="number" min="0" {...register('preparationTime')} className="w-20 text-sm" placeholder="—" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isVeg} onCheckedChange={(v) => setValue('isVeg', v, { shouldDirty: true })} id="isVeg" />
              <Label htmlFor="isVeg" className="text-xs text-gray-700 flex items-center gap-1 cursor-pointer">
                <Leaf size={12} className="text-emerald-600" /> Vegetarian
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isAvailable} onCheckedChange={(v) => setValue('isAvailable', v, { shouldDirty: true })} id="isAvailable" />
              <Label htmlFor="isAvailable" className="text-xs text-gray-700 cursor-pointer">Available</Label>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={!isDirty} loading={saveMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Attach existing groups modal ─────────────────────────────────────────────

function AttachGroupModal({
  allGroups, attachedIds, restaurantId, itemId, onClose,
}: {
  allGroups: ModifierGroup[]
  attachedIds: string[]
  restaurantId: string
  itemId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const unattached = allGroups.filter((g) => !attachedIds.includes(g.id))
  const [selected, setSelected] = useState<string[]>([])

  const attachMutation = useMutation({
    mutationFn: () =>
      Promise.all(selected.map((gid) => menuApi.attachModifierGroup(restaurantId, itemId, gid))),
    onSuccess: () => {
      toast.success(`${selected.length} group${selected.length !== 1 ? 's' : ''} attached`)
      qc.invalidateQueries({ queryKey: ['menu', 'item', restaurantId, itemId] })
      onClose()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Attach Modifier Group</DialogTitle>
        </DialogHeader>
        {unattached.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            All modifier groups are already attached to this item.<br />
            Go to <span className="font-medium">Modifier Groups</span> tab to create new ones.
          </p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {unattached.map((g) => (
              <label
                key={g.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  selected.includes(g.id)
                    ? 'border-brand bg-brand/5'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(g.id)}
                  onChange={() => toggle(g.id)}
                  className="mt-0.5 accent-brand"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{g.name}</span>
                    <Badge variant={g.isRequired ? 'default' : 'secondary'} className="text-2xs">
                      {g.isRequired ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pick {g.minSelect}–{g.maxSelect} · {g.modifiers?.length ?? 0} option{(g.modifiers?.length ?? 0) !== 1 ? 's' : ''}: {g.modifiers?.slice(0, 3).map(m => m.name).join(', ')}{(g.modifiers?.length ?? 0) > 3 ? '…' : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {unattached.length > 0 && (
            <Button
              disabled={selected.length === 0}
              loading={attachMutation.isPending}
              onClick={() => attachMutation.mutate()}
            >
              Attach {selected.length > 0 ? `(${selected.length})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Create & attach new group modal ─────────────────────────────────────────

const newGroupSchema = z.object({
  name:       z.string().min(1, 'Name is required').max(100),
  isRequired: z.boolean(),
  minSelect:  z.coerce.number().int().min(0),
  maxSelect:  z.coerce.number().int().min(1),
})
type NewGroupForm = z.infer<typeof newGroupSchema>

interface DraftOption { name: string; priceAdjustment: string }

function CreateGroupModal({
  restaurantId, itemId, onClose,
}: { restaurantId: string; itemId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [options, setOptions] = useState<DraftOption[]>([{ name: '', priceAdjustment: '0' }])

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<NewGroupForm>({
    resolver: zodResolver(newGroupSchema),
    defaultValues: { name: '', isRequired: false, minSelect: 0, maxSelect: 1 },
  })

  const isRequired = watch('isRequired')

  function addOption() { setOptions((o) => [...o, { name: '', priceAdjustment: '0' }]) }
  function removeOption(i: number) { setOptions((o) => o.filter((_, idx) => idx !== i)) }
  function updateOption(i: number, field: keyof DraftOption, val: string) {
    setOptions((o) => o.map((opt, idx) => idx === i ? { ...opt, [field]: val } : opt))
  }

  const createMutation = useMutation({
    mutationFn: async (form: NewGroupForm) => {
      const dto: CreateModifierGroupDto = {
        name:       form.name,
        isRequired: form.isRequired,
        minSelect:  form.minSelect,
        maxSelect:  form.maxSelect,
        modifiers:  options
          .filter((o) => o.name.trim())
          .map((o) => ({ name: o.name.trim(), priceAdjustment: Number(o.priceAdjustment) || 0 })),
      }
      const group = await menuApi.createModifierGroup(restaurantId, dto)
      await menuApi.attachModifierGroup(restaurantId, itemId, group.id)
      return group
    },
    onSuccess: (group) => {
      toast.success(`"${group.name}" created and attached`)
      qc.invalidateQueries({ queryKey: ['menu', 'item', restaurantId, itemId] })
      qc.invalidateQueries({ queryKey: ['menu', 'modifier-groups', restaurantId] })
      onClose()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Create &amp; Attach New Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
          {/* Group name */}
          <div>
            <Label className="text-xs font-medium text-gray-700 mb-1 block">Group Name *</Label>
            <Input {...register('name')} placeholder="e.g. Size, Add-ons, Spice Level" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Required + min/max */}
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2">
              <Switch
                checked={isRequired}
                onCheckedChange={(v) => setValue('isRequired', v)}
                id="gr-required"
              />
              <Label htmlFor="gr-required" className="text-xs text-gray-700 cursor-pointer">Required</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">Min select</Label>
              <Input type="number" min="0" {...register('minSelect')} className="w-16 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500 whitespace-nowrap">Max select</Label>
              <Input type="number" min="1" {...register('maxSelect')} className="w-16 text-sm" />
            </div>
          </div>

          {/* Options */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium text-gray-700">Options</Label>
              <button type="button" onClick={addOption}
                className="text-xs text-brand hover:underline flex items-center gap-1">
                <Plus size={12} /> Add option
              </button>
            </div>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={opt.name}
                    onChange={(e) => updateOption(i, 'name', e.target.value)}
                    placeholder={`Option ${i + 1} name`}
                    className="flex-1"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">+৳</span>
                    <Input
                      type="number"
                      step="0.01"
                      value={opt.priceAdjustment}
                      onChange={(e) => updateOption(i, 'priceAdjustment', e.target.value)}
                      placeholder="0"
                      className="pl-7 text-sm"
                    />
                  </div>
                  {options.length > 1 && (
                    <button type="button" onClick={() => removeOption(i)}
                      className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-2xs text-gray-400 mt-2">Leave price as 0 for no extra charge.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={createMutation.isPending}>Create &amp; Attach</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Modifier groups section ──────────────────────────────────────────────────

// ─── Edit Group Dialog ────────────────────────────────────────────────────────

function EditGroupDialog({
  group, restaurantId, itemId, onClose,
}: { group: ModifierGroup; restaurantId: string; itemId: string; onClose: () => void }) {
  const qc = useQueryClient()

  // Group-level state
  const [name, setName]           = useState(group.name)
  const [isRequired, setIsRequired] = useState(group.isRequired ?? false)
  const [minSelect, setMinSelect] = useState(String(group.minSelect ?? 0))
  const [maxSelect, setMaxSelect] = useState(String(group.maxSelect ?? 1))

  // Modifier editing state
  const [modifiers, setModifiers] = useState<Modifier[]>(group.modifiers ?? [])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName]   = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [newName, setNewName]     = useState('')
  const [newPrice, setNewPrice]   = useState('')
  const [saving, setSaving]       = useState(false)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['menu', 'item', restaurantId, itemId] })
    qc.invalidateQueries({ queryKey: ['menu', 'modifier-groups', restaurantId] })
  }

  async function saveGroup() {
    setSaving(true)
    try {
      const dto: UpdateModifierGroupDto = {
        name,
        isRequired,
        minSelect: parseInt(minSelect) || 0,
        maxSelect: parseInt(maxSelect) || 1,
      }
      await menuApi.updateModifierGroup(restaurantId, group.id, dto)
      invalidate()
      toast.success('Group saved')
      onClose()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function startEdit(m: Modifier) {
    setEditingId(m.id)
    setEditName(m.name)
    setEditPrice(String(m.priceAdjustment ?? ''))
  }

  async function saveModifier(m: Modifier) {
    try {
      await menuApi.updateModifier(restaurantId, group.id, m.id, {
        name: editName.trim() || m.name,
        priceAdjustment: parseFloat(editPrice) || 0,
      })
      setModifiers((prev) => prev.map((x) => x.id === m.id ? { ...x, name: editName.trim() || m.name, priceAdjustment: String(parseFloat(editPrice) || 0) } : x))
      setEditingId(null)
      invalidate()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  async function deleteModifier(m: Modifier) {
    try {
      await menuApi.deleteModifier(restaurantId, group.id, m.id)
      setModifiers((prev) => prev.filter((x) => x.id !== m.id))
      invalidate()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  async function addModifier() {
    if (!newName.trim()) return
    try {
      const dto: CreateModifierDto = {
        name: newName.trim(),
        priceAdjustment: parseFloat(newPrice) || 0,
      }
      const created = await menuApi.addModifier(restaurantId, group.id, dto)
      setModifiers((prev) => [...prev, created])
      setNewName('')
      setNewPrice('')
      invalidate()
    } catch (err) {
      toast.error(apiError(err))
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Modifier Group</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Group settings */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Group name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Size, Toppings" />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <Label>Min select</Label>
                <Input type="number" min="0" value={minSelect} onChange={(e) => setMinSelect(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Max select</Label>
                <Input type="number" min="1" value={maxSelect} onChange={(e) => setMaxSelect(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
                <span className="text-sm text-gray-600">Required</span>
              </div>
            </div>
          </div>

          {/* Options list */}
          <div className="space-y-1.5">
            <Label>Options</Label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
              {modifiers.length === 0 && (
                <p className="text-xs text-gray-400 italic px-3 py-2">No options yet</p>
              )}
              {modifiers.map((m) => (
                <div key={m.id} className="flex items-center gap-2 px-3 py-2">
                  {editingId === m.id ? (
                    <>
                      <Input
                        className="h-7 text-sm flex-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveModifier(m)}
                        autoFocus
                      />
                      <Input
                        className="h-7 text-sm w-20"
                        type="number"
                        placeholder="price"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveModifier(m)}
                      />
                      <button onClick={() => saveModifier(m)} className="text-brand hover:text-brand/80 text-sm font-medium">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800">{m.name}</span>
                      {Number(m.priceAdjustment ?? 0) !== 0 && (
                        <span className="text-xs text-gray-400">{fmtPrice(m.priceAdjustment)}</span>
                      )}
                      <button onClick={() => startEdit(m)} className="text-gray-400 hover:text-brand transition-colors p-0.5"><Pencil size={13} /></button>
                      <button onClick={() => deleteModifier(m)} className="text-gray-400 hover:text-red-500 transition-colors p-0.5"><Trash2 size={13} /></button>
                    </>
                  )}
                </div>
              ))}

              {/* Add new option row */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                <Input
                  className="h-7 text-sm flex-1"
                  placeholder="New option name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addModifier()}
                />
                <Input
                  className="h-7 text-sm w-20"
                  type="number"
                  placeholder="+price"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addModifier()}
                />
                <button
                  onClick={addModifier}
                  disabled={!newName.trim()}
                  className="text-brand hover:text-brand/80 disabled:text-gray-300 transition-colors p-0.5"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={saveGroup} loading={saving}>Save Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Attached Group Card ──────────────────────────────────────────────────────

function AttachedGroupCard({
  group, restaurantId, itemId,
}: { group: ModifierGroup; restaurantId: string; itemId: string }) {
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)

  const detachMutation = useMutation({
    mutationFn: () => menuApi.detachModifierGroup(restaurantId, itemId, group.id),
    onSuccess: () => {
      toast.success(`"${group.name}" removed`)
      qc.invalidateQueries({ queryKey: ['menu', 'item', restaurantId, itemId] })
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const modifiers: Modifier[] = group.modifiers ?? []

  return (
    <>
      <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
        {/* Group header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-medium text-gray-900 text-sm">{group.name}</span>
            <Badge variant={group.isRequired ? 'default' : 'secondary'} className="text-2xs">
              {group.isRequired ? '● Required' : '○ Optional'}
            </Badge>
            <Badge variant="outline" className="text-2xs text-gray-500">
              pick {group.minSelect}–{group.maxSelect}
            </Badge>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowEdit(true)}
              className="text-gray-400 hover:text-brand transition-colors p-0.5"
              title="Edit group"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => detachMutation.mutate()}
              disabled={detachMutation.isPending}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5"
              title="Remove from this item"
            >
              {detachMutation.isPending
                ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75"/></svg>
                : <X size={16} />
              }
            </button>
          </div>
        </div>

        {/* Options */}
        {modifiers.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No options yet — click the pencil to add some</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {modifiers.map((m) => (
              <span
                key={m.id}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border',
                  Number(m.priceAdjustment ?? 0) > 0
                    ? 'bg-orange-50 border-orange-200 text-orange-700'
                    : Number(m.priceAdjustment ?? 0) < 0
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600',
                )}
              >
                {m.name}
                {Number(m.priceAdjustment ?? 0) !== 0 && (
                  <span className="opacity-70">{fmtPrice(m.priceAdjustment)}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {showEdit && (
        <EditGroupDialog
          group={group}
          restaurantId={restaurantId}
          itemId={itemId}
          onClose={() => setShowEdit(false)}
        />
      )}
    </>
  )
}

function ModifierGroupsCard({
  itemId, restaurantId,
}: { itemId: string; restaurantId: string }) {
  const [showAttach, setShowAttach] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const { data: itemDetail } = useQuery({
    queryKey: ['menu', 'item', restaurantId, itemId],
    queryFn:  () => menuApi.getItem(restaurantId, itemId),
    enabled:  !!restaurantId && !!itemId,
  })

  const { data: allGroups = [] } = useQuery({
    queryKey: ['menu', 'modifier-groups', restaurantId],
    queryFn:  () => menuApi.listModifierGroups(restaurantId),
    enabled:  !!restaurantId,
  })

  // Backend returns ItemModifierGroup[] with nested modifierGroup object
  const attachedGroups: ModifierGroup[] = (itemDetail?.modifierGroups ?? []).map(
    (ig: any) => ig.modifierGroup ?? ig,
  )
  const attachedIds = attachedGroups.map((g) => g.id)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 size={16} className="text-gray-400" />
            Modifier Groups
            {attachedGroups.length > 0 && (
              <Badge variant="secondary" className="text-2xs font-normal">
                {attachedGroups.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAttach(true)}>
              <Link2 size={14} /> Attach existing
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create &amp; attach new
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {attachedGroups.length === 0 ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center border-2 border-dashed border-gray-100 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
              <Settings2 size={22} className="text-gray-300" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">No modifier groups yet</p>
              <p className="text-xs text-gray-400 mt-1">
                Attach existing groups or create new ones — like Size, Add-ons, or Spice Level.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button variant="outline" size="sm" onClick={() => setShowAttach(true)}>
                <Link2 size={13} /> Attach existing
              </Button>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={13} /> Create &amp; attach new
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {attachedGroups.map((g) => (
              <AttachedGroupCard
                key={g.id}
                group={g}
                restaurantId={restaurantId}
                itemId={itemId}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Removing a group only unlinks it from this item — it stays available for other items.
        </p>
      </CardContent>

      {showAttach && (
        <AttachGroupModal
          allGroups={allGroups}
          attachedIds={attachedIds}
          restaurantId={restaurantId}
          itemId={itemId}
          onClose={() => setShowAttach(false)}
        />
      )}
      {showCreate && (
        <CreateGroupModal
          restaurantId={restaurantId}
          itemId={itemId}
          onClose={() => setShowCreate(false)}
        />
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''

  const { data: item, isLoading, isError } = useQuery({
    queryKey: ['menu', 'item', restaurantId, itemId],
    queryFn:  () => menuApi.getItem(restaurantId, itemId!),
    enabled:  !!restaurantId && !!itemId,
  })

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin h-6 w-6 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    )
  }

  if (isError || !item) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        Item not found.{' '}
        <button onClick={() => navigate('/menu/items')} className="text-brand hover:underline">
          Back to items
        </button>
      </div>
    )
  }

  const isVeg = item.dietaryTags?.includes('vegetarian')

  return (
    <div className="flex-1 overflow-auto bg-surface-muted">
    <div className="p-6 md:p-8 max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/menu/items')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
        >
          <ArrowLeft size={15} /> Back to Items
        </button>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <UtensilsCrossed size={20} className="text-gray-300" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {item.name}
              {isVeg && <Leaf size={14} className="text-emerald-600" />}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatCurrency(Number(item.price))}
              {item.category && <span className="mx-1.5">·</span>}
              {item.category?.name}
              <span className="mx-1.5">·</span>
              <span className={item.isAvailable ? 'text-green-600' : 'text-gray-400'}>
                {item.isAvailable ? 'Available' : 'Unavailable'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Item Details */}
      <ItemDetailsCard
        item={item}
        restaurantId={restaurantId}
        onSaved={() => {}}
      />

      {/* Modifier Groups */}
      <ModifierGroupsCard
        itemId={itemId!}
        restaurantId={restaurantId}
      />
    </div>
    </div>
  )
}
