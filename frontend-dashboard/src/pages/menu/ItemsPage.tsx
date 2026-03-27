import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  UtensilsCrossed,
  Search,
  ChevronDown,
  ChevronRight,
  Leaf,
  Tag,
  Check,
  Lock,
  Upload,
  X,
  ImageOff,
} from 'lucide-react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { menuApi } from '@/lib/menu.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { formatCurrency, cn } from '@/lib/utils'
import type {
  MenuItem,
  Category,
  ModifierGroup,
  Modifier,
  CreateMenuItemDto,
  CreateModifierGroupDto,
  CreateModifierDto,
} from '@/types/menu.types'

// ─── Styled native select ─────────────────────────────────────────────────────

function NativeSelect({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${className ?? ''}`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'items' | 'modifiers'

function Tabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'items', label: 'Items' },
    { id: 'modifiers', label: 'Modifier Groups' },
  ]
  return (
    <div className="flex gap-1 border-b border-border mb-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            active === t.id
              ? 'border-brand text-brand'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEMS TAB
// ─────────────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  categoryId: z.string().min(1, 'Category is required'),
  price: z.coerce.number().min(0, 'Price must be ≥ 0'),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().optional(),
  isVeg: z.boolean(),           // UI convenience — maps to dietaryTags on submit
  preparationTime: z.coerce.number().int().min(0).optional().nullable(),
  isAvailable: z.boolean(),
})

type ItemForm = z.infer<typeof itemSchema>

function ItemDialog({
  item,
  categories,
  allGroups,
  initialGroupIds,
  restaurantId,
  onClose,
  onSave,
  loading,
}: {
  item: MenuItem | null
  categories: Category[]
  allGroups: ModifierGroup[]
  initialGroupIds: string[]
  restaurantId: string
  onClose: () => void
  onSave: (data: ItemForm, groupIds: string[]) => void
  loading: boolean
}) {
  const isEdit = !!item
  const defaultIsVeg = item?.dietaryTags?.includes('vegetarian') ?? false
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(initialGroupIds)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: item?.name ?? '',
      categoryId: item?.categoryId ?? '',
      price: Number(item?.price ?? 0),
      description: item?.description ?? '',
      imageUrl: item?.imageUrl ?? '',
      isVeg: defaultIsVeg,
      preparationTime: item?.preparationTime ?? null,
      isAvailable: item?.isAvailable ?? true,
    },
  })

  const isVeg = watch('isVeg')
  const isAvailable = watch('isAvailable')
  const categoryId = watch('categoryId')
  const imageUrl = watch('imageUrl')

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    )
  }

  async function uploadFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are supported')
      return
    }
    setUploading(true)
    try {
      const url = await menuApi.uploadImage(restaurantId, file)
      setValue('imageUrl', url, { shouldValidate: true })
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const file = Array.from(e.clipboardData.items)
      .find((item) => item.type.startsWith('image/'))
      ?.getAsFile()
    if (file) uploadFile(file)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'New Menu Item'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((data) => onSave(data, selectedGroupIds))} onPaste={handlePaste} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="item-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input id="item-name" placeholder="e.g. Butter Chicken, Veg Biryani…" {...register('name')} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          {/* Category + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Category <span className="text-red-500">*</span>
              </Label>
              <NativeSelect
                value={categoryId}
                onChange={(v) => setValue('categoryId', v)}
                placeholder="Select…"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
              {errors.categoryId && (
                <p className="text-xs text-red-500">{errors.categoryId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-price">
                Price (৳) <span className="text-red-500">*</span>
              </Label>
              <Input id="item-price" type="number" step="0.01" min="0" placeholder="0.00" {...register('price')} />
              {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
              {!errors.price && Number(watch('price')) === 0 && (
                <p className="text-xs text-amber-600">⚠ Price is ৳0.00 — is this item free?</p>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea id="item-desc" placeholder="Describe this item…" rows={2} {...register('description')} />
          </div>

          {/* Image */}
          <div className="space-y-1.5">
            <Label>Item Photo</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleImageFile}
            />
            <div className="flex items-center gap-3">
              {/* Thumbnail */}
              <div
                className={cn(
                  'relative w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0 overflow-hidden bg-gray-50 transition-colors',
                  dragOver ? 'border-brand bg-brand/5' : 'border-gray-200',
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setValue('imageUrl', '', { shouldValidate: true })}
                      className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  <Upload size={16} className="text-gray-300" />
                )}
              </div>
              {/* Actions */}
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-fit px-3 py-1.5 text-sm font-medium border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {uploading ? 'Uploading…' : imageUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                {!imageUrl && (
                  <Input
                    type="text"
                    placeholder="or paste URL"
                    className="h-8 text-sm"
                    {...register('imageUrl')}
                  />
                )}
                <p className="text-xs text-gray-400">JPEG · PNG · WebP · max 5 MB</p>
              </div>
            </div>
          </div>

          {/* Prep time */}
          <div className="space-y-1.5">
            <Label htmlFor="item-prep">Preparation Time (minutes)</Label>
            <Input id="item-prep" type="number" min="0" placeholder="e.g. 15" {...register('preparationTime')} />
          </div>

          {/* Modifier Groups picker */}
          {allGroups.length > 0 && (
            <div className="space-y-2">
              <Label>
                Modifier Groups
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  ({selectedGroupIds.length} selected)
                </span>
              </Label>
              <div className="rounded-lg border border-border divide-y divide-border">
                {allGroups.map((group) => {
                  const checked = selectedGroupIds.includes(group.id)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-subtle transition-colors text-left"
                    >
                      <div
                        className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          checked ? 'bg-brand border-brand' : 'border-gray-300'
                        }`}
                      >
                        {checked && <Check size={10} strokeWidth={3} className="text-white" />}
                      </div>
                      <span className="flex-1 text-sm font-medium text-gray-800">{group.name}</span>
                      <div className="flex gap-1.5">
                        <Badge variant={group.isRequired ? 'default' : 'secondary'} className="text-2xs">
                          {group.isRequired ? 'Required' : 'Optional'}
                        </Badge>
                        <Badge variant="outline" className="text-2xs">
                          {group.modifiers.length} opt
                        </Badge>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-surface-subtle">
              <div className="flex items-center gap-2">
                <Leaf size={14} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Vegetarian</p>
                  <p className="text-xs text-gray-500">Shows veg indicator on menu</p>
                </div>
              </div>
              <Switch checked={isVeg} onCheckedChange={(v) => setValue('isVeg', v)} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-surface-subtle">
              <div>
                <p className="text-sm font-medium text-gray-700">Available</p>
                <p className="text-xs text-gray-500">Unavailable items can&apos;t be ordered</p>
              </div>
              <Switch checked={isAvailable} onCheckedChange={(v) => setValue('isAvailable', v)} />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={loading}>
              {isEdit ? 'Save Changes' : 'Create Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ItemRow({
  item,
  categories,
  onDelete,
  onToggle,
  toggling,
}: {
  item: MenuItem
  categories: Category[]
  onDelete: (i: MenuItem) => void
  onToggle: (i: MenuItem, available: boolean) => void
  toggling: boolean
}) {
  const navigate = useNavigate()
  const cat = categories.find((c) => c.id === item.categoryId)
  const isVeg = item.dietaryTags?.includes('vegetarian')

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-white hover:bg-surface-subtle transition-colors group">
      {/* Image */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-lg bg-surface-subtle border border-border overflow-hidden flex items-center justify-center cursor-pointer"
        onClick={() => navigate(`/menu/items/${item.id}`)}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
            onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <UtensilsCrossed size={18} className="text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/menu/items/${item.id}`)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 truncate hover:text-brand transition-colors">{item.name}</span>
          {isVeg && <Leaf size={12} className="text-emerald-600 flex-shrink-0" title="Vegetarian" />}
          {cat && <Badge variant="secondary" className="text-2xs">{cat.name}</Badge>}
        </div>
        {item.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>
        )}
        {item.preparationTime && (
          <p className="text-2xs text-gray-400 mt-0.5">{item.preparationTime} min prep</p>
        )}
        {(item._count?.modifierGroups ?? 0) > 0 && (
          <p className="text-2xs text-brand mt-0.5">
            {item._count!.modifierGroups} modifier group{item._count!.modifierGroups !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Price */}
      <div className="flex-shrink-0 text-right min-w-[64px]">
        <span className="text-sm font-semibold text-gray-900">
          {formatCurrency(Number(item.price))}
        </span>
      </div>

      {/* Availability */}
      <div className="flex-shrink-0 flex items-center gap-2">
        <Badge variant={item.isAvailable ? 'success' : 'secondary'} className="text-2xs">
          {item.isAvailable ? 'Available' : 'Off'}
        </Badge>
        <Switch
          checked={item.isAvailable}
          onCheckedChange={(v) => onToggle(item, v)}
          disabled={toggling}
        />
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate(`/menu/items/${item.id}`)}>
            <Pencil size={14} />Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onDelete(item)} className="text-red-600 focus:text-red-600">
            <Trash2 size={14} />Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function ItemsTab({ restaurantId, categories }: { restaurantId: string; categories: Category[] }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterAvail, setFilterAvail] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MenuItem | null>(null)
  const [editGroupIds, setEditGroupIds] = useState<string[]>([])
  const [deleteTarget, setDeleteTarget] = useState<MenuItem | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu', 'items', restaurantId],
    queryFn: () => menuApi.listItems(restaurantId),
    enabled: !!restaurantId,
  })

  const { data: allGroups = [] } = useQuery({
    queryKey: ['menu', 'modifier-groups', restaurantId],
    queryFn: () => menuApi.listModifierGroups(restaurantId),
    enabled: !!restaurantId,
  })

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat && item.categoryId !== filterCat) return false
      if (filterAvail === 'available' && !item.isAvailable) return false
      if (filterAvail === 'unavailable' && item.isAvailable) return false
      return true
    })
  }, [items, search, filterCat, filterAvail])

  const invalidate = () => qc.invalidateQueries({ queryKey: ['menu', 'items', restaurantId] })

  const createMutation = useMutation({
    mutationFn: async ({ dto, groupIds }: { dto: CreateMenuItemDto; groupIds: string[] }) => {
      const item = await menuApi.createItem(restaurantId, dto)
      await Promise.all(groupIds.map((gid) => menuApi.attachModifierGroup(restaurantId, item.id, gid)))
      return item
    },
    onSuccess: () => { toast.success('Item created'); setDialogOpen(false); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
      groupIds,
      currentGroupIds,
    }: {
      id: string
      dto: Partial<CreateMenuItemDto>
      groupIds: string[]
      currentGroupIds: string[]
    }) => {
      const item = await menuApi.updateItem(restaurantId, id, dto)
      const toAttach = groupIds.filter((g) => !currentGroupIds.includes(g))
      const toDetach = currentGroupIds.filter((g) => !groupIds.includes(g))
      await Promise.all([
        ...toAttach.map((gid) => menuApi.attachModifierGroup(restaurantId, id, gid)),
        ...toDetach.map((gid) => menuApi.detachModifierGroup(restaurantId, id, gid)),
      ])
      return item
    },
    onSuccess: () => {
      toast.success('Item updated')
      setDialogOpen(false)
      setEditTarget(null)
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => menuApi.deleteItem(restaurantId, id),
    onSuccess: () => { toast.success('Item deleted'); setDeleteTarget(null); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      menuApi.toggleAvailability(restaurantId, id, isAvailable),
    onSuccess: (_, vars) => {
      toast.success(vars.isAvailable ? 'Marked available' : 'Marked unavailable')
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  function buildDietaryTags(form: ItemForm, existing: MenuItem | null): string[] {
    const base = existing?.dietaryTags?.filter((t) => t !== 'vegetarian') ?? []
    return form.isVeg ? [...base, 'vegetarian'] : base
  }

  async function openEditDialog(item: MenuItem) {
    // Fetch current modifier group ids for this item
    try {
      const detail = await menuApi.getItem(restaurantId, item.id)
      // Backend returns ItemModifierGroup[] with nested modifierGroup
      const groupIds = (detail.modifierGroups ?? []).map(
        (mg: any) => mg.modifierGroup?.id ?? mg.modifierGroupId ?? mg.id,
      )
      setEditGroupIds(groupIds)
    } catch {
      setEditGroupIds([])
    }
    setEditTarget(item)
    setDialogOpen(true)
  }

  function handleSave(form: ItemForm, groupIds: string[]) {
    const dto: CreateMenuItemDto = {
      name: form.name,
      categoryId: form.categoryId,
      price: form.price,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
      isAvailable: form.isAvailable,
      preparationTime: form.preparationTime || undefined,
      dietaryTags: buildDietaryTags(form, editTarget),
    }
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, dto, groupIds, currentGroupIds: editGroupIds })
    } else {
      createMutation.mutate({ dto, groupIds })
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <NativeSelect
          value={filterCat}
          onChange={setFilterCat}
          options={[
            { value: '', label: 'All categories' },
            ...categories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="w-full sm:w-44"
        />
        <NativeSelect
          value={filterAvail}
          onChange={setFilterAvail}
          options={[
            { value: '', label: 'Any availability' },
            { value: 'available', label: 'Available' },
            { value: 'unavailable', label: 'Unavailable' },
          ]}
          className="w-full sm:w-40"
        />
        <Button onClick={() => { setEditTarget(null); setEditGroupIds([]); setDialogOpen(true) }}>
          <Plus size={16} />Add Item
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-surface-subtle">
              <UtensilsCrossed size={28} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900">No items yet</p>
              <p className="text-sm text-gray-500 mt-1">Add your first menu item to get started.</p>
            </div>
            <Button onClick={() => { setEditTarget(null); setEditGroupIds([]); setDialogOpen(true) }} className="mt-2">
              <Plus size={16} />Add Item
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && items.length > 0 && filtered.length === 0 && (
        <div className="py-12 text-center text-gray-500 text-sm">No items match your filters.</div>
      )}

      {!isLoading && items.length > 0 && items.some((i) => !i.imageUrl) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
          <ImageOff size={16} className="text-amber-600 flex-shrink-0" />
          <p className="text-amber-800">
            <span className="font-semibold">
              {items.filter((i) => !i.imageUrl).length} item{items.filter((i) => !i.imageUrl).length !== 1 ? 's' : ''}
            </span>{' '}
            {items.filter((i) => !i.imageUrl).length === 1 ? 'has' : 'have'} no photo — adding photos improves customer conversions
          </p>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-3">
            {filtered.length} of {items.length} item{items.length !== 1 ? 's' : ''}
          </p>
          {filtered.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              categories={categories}
              onDelete={setDeleteTarget}
              onToggle={(i, v) => toggleMutation.mutate({ id: i.id, isAvailable: v })}
              toggling={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {dialogOpen && (
        <ItemDialog
          item={editTarget}
          categories={categories}
          allGroups={allGroups}
          initialGroupIds={editGroupIds}
          restaurantId={restaurantId}
          onClose={() => { setDialogOpen(false); setEditTarget(null) }}
          onSave={handleSave}
          loading={saving}
        />
      )}

      {deleteTarget && (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Delete Item</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold">&ldquo;{deleteTarget.name}&rdquo;</span>? This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                loading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODIFIER GROUPS TAB
// ─────────────────────────────────────────────────────────────────────────────

const groupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  isRequired: z.boolean(),
  minSelect: z.coerce.number().int().min(0),
  maxSelect: z.coerce.number().int().min(1),
})

type GroupForm = z.infer<typeof groupSchema>

const modifierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  priceAdjustment: z.coerce.number(),
  isAvailable: z.boolean(),
  isRequired: z.boolean(),
})

type ModifierForm = z.infer<typeof modifierSchema>

function GroupDialog({
  group,
  onClose,
  onSave,
  loading,
}: {
  group: ModifierGroup | null
  onClose: () => void
  onSave: (data: GroupForm) => void
  loading: boolean
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group?.name ?? '',
      isRequired: group?.isRequired ?? false,
      minSelect: group?.minSelect ?? 0,
      maxSelect: group?.maxSelect ?? 1,
    },
  })

  const isRequired = watch('isRequired')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{group ? 'Edit Modifier Group' : 'New Modifier Group'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Group Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Size, Add-ons, Spice Level…" {...register('name')} />
            <p className="text-xs text-gray-400">Internal name used in the admin panel</p>
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-subtle">
            <div>
              <p className="text-sm font-medium text-gray-700">Required</p>
              <p className="text-xs text-gray-500">Customer must select from this group</p>
            </div>
            <Switch checked={isRequired} onCheckedChange={(v) => setValue('isRequired', v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min selections</Label>
              <Input type="number" min="0" {...register('minSelect')} />
            </div>
            <div className="space-y-1.5">
              <Label>Max selections</Label>
              <Input type="number" min="1" {...register('maxSelect')} />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={loading}>
              {group ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ModifierDialog({
  modifier,
  groupName,
  onClose,
  onSave,
  loading,
}: {
  modifier: Modifier | null
  groupName: string
  onClose: () => void
  onSave: (data: ModifierForm) => void
  loading: boolean
}) {
  const { register, handleSubmit, watch, setValue } = useForm<ModifierForm>({
    resolver: zodResolver(modifierSchema),
    defaultValues: {
      name: modifier?.name ?? '',
      priceAdjustment: Number(modifier?.priceAdjustment ?? 0),
      isAvailable: modifier?.isAvailable ?? true,
      isRequired: modifier?.isRequired ?? false,
    },
  })

  const isAvailable = watch('isAvailable')
  const isRequired = watch('isRequired')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{modifier ? 'Edit Option' : `Add to "${groupName}"`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. Extra Cheese, Large, Spicy…" {...register('name')} />
          </div>

          <div className="space-y-1.5">
            <Label>Price (৳)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0"
              {...register('priceAdjustment')}
            />
            <p className="text-xs text-gray-400">
              Extra charge added to the item price. Use 0 for no extra cost, negative for a discount.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-subtle">
            <p className="text-sm font-medium text-gray-700">Available</p>
            <Switch checked={isAvailable} onCheckedChange={(v) => setValue('isAvailable', v)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-subtle">
            <div>
              <p className="text-sm font-medium text-gray-700">Required</p>
              <p className="text-xs text-gray-500">Auto-selected, customer cannot remove</p>
            </div>
            <Switch checked={isRequired} onCheckedChange={(v) => setValue('isRequired', v)} />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            </DialogClose>
            <Button type="submit" loading={loading}>
              {modifier ? 'Save' : 'Add Option'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ModifierGroupCard({
  group,
  restaurantId,
  onEditGroup,
  onDeleteGroup,
  depth = 0,
}: {
  group: ModifierGroup
  restaurantId: string
  onEditGroup: (g: ModifierGroup) => void
  onDeleteGroup: (g: ModifierGroup) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [modDialog, setModDialog] = useState<{ open: boolean; modifier: Modifier | null }>({
    open: false,
    modifier: null,
  })
  const [subGroupDialog, setSubGroupDialog] = useState<{
    open: boolean
    parentModifierId: string | null
  }>({ open: false, parentModifierId: null })
  const qc = useQueryClient()

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['menu', 'modifier-groups', restaurantId] })

  const addModMutation = useMutation({
    mutationFn: (dto: CreateModifierDto) => menuApi.addModifier(restaurantId, group.id, dto),
    onSuccess: () => {
      toast.success('Option added')
      setModDialog({ open: false, modifier: null })
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateModMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateModifierDto> }) =>
      menuApi.updateModifier(restaurantId, group.id, id, dto),
    onSuccess: () => {
      toast.success('Option updated')
      setModDialog({ open: false, modifier: null })
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const deleteModMutation = useMutation({
    mutationFn: (modId: string) => menuApi.deleteModifier(restaurantId, group.id, modId),
    onSuccess: () => { toast.success('Option deleted'); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  const createChildGroupMutation = useMutation({
    mutationFn: (dto: CreateModifierGroupDto) => menuApi.createModifierGroup(restaurantId, dto),
    onSuccess: () => {
      toast.success('Sub-options group created')
      setSubGroupDialog({ open: false, parentModifierId: null })
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  function handleModSave(form: ModifierForm) {
    if (modDialog.modifier) {
      updateModMutation.mutate({ id: modDialog.modifier.id, dto: form })
    } else {
      addModMutation.mutate(form)
    }
  }

  function handleSubGroupSave(form: GroupForm) {
    createChildGroupMutation.mutate({
      name: form.name,
      isRequired: form.isRequired,
      minSelect: form.minSelect,
      maxSelect: form.maxSelect,
      parentModifierId: subGroupDialog.parentModifierId ?? undefined,
    })
  }

  const modSaving = addModMutation.isPending || updateModMutation.isPending

  const cardClassName = depth === 0
    ? ''
    : 'border-l-4 border-l-brand/30 bg-orange-50/30'

  return (
    <>
      <Card className={cardClassName}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setExpanded((p) => !p)}
                className="flex items-center gap-2 hover:text-gray-900 transition-colors"
              >
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div>
                  <CardTitle className={depth === 0 ? 'text-base' : 'text-sm'}>{group.name}</CardTitle>
                </div>
              </button>
              <div className="flex gap-1.5">
                <Badge variant={group.isRequired ? 'default' : 'secondary'} className="text-2xs">
                  {group.isRequired ? 'Required' : 'Optional'}
                </Badge>
                <Badge variant="info" className="text-2xs">
                  {group.minSelect}–{group.maxSelect} select
                </Badge>
                <Badge variant="outline" className="text-2xs">
                  {group.modifiers.length} options
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setExpanded(true); setModDialog({ open: true, modifier: null }) }}
              >
                <Plus size={12} />Add Option
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon"><MoreHorizontal size={16} /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEditGroup(group)}>
                    <Pencil size={14} />Edit Group
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteGroup(group)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 size={14} />Delete Group
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent>
            {group.modifiers.length === 0 ? (
              <p className="text-sm text-gray-400 italic py-2">
                No options yet. Click &ldquo;Add Option&rdquo; above.
              </p>
            ) : (
              <div className="space-y-2">
                {group.modifiers.map((mod) => (
                  <div key={mod.id}>
                    {/* Modifier row */}
                    <div className={cn('flex items-center gap-3 px-3 py-2 rounded-md border border-border group/mod', mod.isRequired ? 'bg-orange-50/60' : 'bg-surface-subtle')}>
                      {mod.childGroups && mod.childGroups.length > 0
                        ? <ChevronRight size={12} className="text-brand flex-shrink-0" />
                        : mod.isRequired
                          ? <Lock size={12} className="text-brand flex-shrink-0" />
                          : <Tag size={12} className="text-gray-400 flex-shrink-0" />
                      }
                      <span className="flex-1 text-sm font-medium text-gray-800">{mod.name}</span>
                      {Number(mod.priceAdjustment) !== 0 && (
                        <span
                          className={`text-sm font-medium ${
                            Number(mod.priceAdjustment) > 0 ? 'text-gray-700' : 'text-emerald-600'
                          }`}
                        >
                          {Number(mod.priceAdjustment) > 0 ? '+' : ''}
                          {formatCurrency(Number(mod.priceAdjustment))}
                        </span>
                      )}
                      <Badge variant={mod.isAvailable ? 'success' : 'secondary'} className="text-2xs">
                        {mod.isAvailable ? 'On' : 'Off'}
                      </Badge>
                      <div className="flex gap-1 opacity-0 group-hover/mod:opacity-100 transition-opacity">
                        {depth < 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-2xs text-brand hover:text-brand"
                            onClick={() => setSubGroupDialog({ open: true, parentModifierId: mod.id })}
                            title="Add sub-options to this modifier"
                          >
                            <Plus size={10} />Sub-options
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setModDialog({ open: true, modifier: mod })}
                        >
                          <Pencil size={11} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-red-500 hover:text-red-700"
                          onClick={() => deleteModMutation.mutate(mod.id)}
                          disabled={deleteModMutation.isPending}
                        >
                          <Trash2 size={11} />
                        </Button>
                      </div>
                    </div>

                    {/* Child groups (nested, indented) */}
                    {mod.childGroups && mod.childGroups.length > 0 && (
                      <div className="ml-6 mt-1.5 space-y-1.5">
                        {mod.childGroups.map((childGroup) => (
                          <ModifierGroupCard
                            key={childGroup.id}
                            group={childGroup}
                            restaurantId={restaurantId}
                            onEditGroup={onEditGroup}
                            onDeleteGroup={onDeleteGroup}
                            depth={depth + 1}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {modDialog.open && (
        <ModifierDialog
          modifier={modDialog.modifier}
          groupName={group.name}
          onClose={() => setModDialog({ open: false, modifier: null })}
          onSave={handleModSave}
          loading={modSaving}
        />
      )}

      {subGroupDialog.open && (
        <GroupDialog
          group={null}
          onClose={() => setSubGroupDialog({ open: false, parentModifierId: null })}
          onSave={handleSubGroupSave}
          loading={createChildGroupMutation.isPending}
        />
      )}
    </>
  )
}

function ModifierGroupsTab({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient()
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; group: ModifierGroup | null }>({
    open: false,
    group: null,
  })
  const [deleteTarget, setDeleteTarget] = useState<ModifierGroup | null>(null)

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['menu', 'modifier-groups', restaurantId],
    queryFn: () => menuApi.listModifierGroups(restaurantId),
    enabled: !!restaurantId,
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['menu', 'modifier-groups', restaurantId] })

  const createGroupMutation = useMutation({
    mutationFn: (dto: CreateModifierGroupDto) => menuApi.createModifierGroup(restaurantId, dto),
    onSuccess: () => {
      toast.success('Group created')
      setGroupDialog({ open: false, group: null })
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreateModifierGroupDto> }) =>
      menuApi.updateModifierGroup(restaurantId, id, dto),
    onSuccess: () => {
      toast.success('Group updated')
      setGroupDialog({ open: false, group: null })
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => menuApi.deleteModifierGroup(restaurantId, id),
    onSuccess: () => { toast.success('Group deleted'); setDeleteTarget(null); invalidate() },
    onError: (err) => toast.error(apiError(err)),
  })

  function handleGroupSave(form: GroupForm) {
    const dto: CreateModifierGroupDto = {
      name: form.name,
      isRequired: form.isRequired,
      minSelect: form.minSelect,
      maxSelect: form.maxSelect,
    }
    if (groupDialog.group) {
      updateGroupMutation.mutate({ id: groupDialog.group.id, dto })
    } else {
      createGroupMutation.mutate(dto)
    }
  }

  const groupSaving = createGroupMutation.isPending || updateGroupMutation.isPending

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setGroupDialog({ open: true, group: null })}>
          <Plus size={16} />New Group
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {!isLoading && groups.length === 0 && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-surface-subtle">
              <Tag size={22} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900">No modifier groups yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Add groups like &ldquo;Size&rdquo;, &ldquo;Spice Level&rdquo;, or &ldquo;Add-ons&rdquo;.
              </p>
            </div>
            <Button onClick={() => setGroupDialog({ open: true, group: null })} className="mt-2">
              <Plus size={16} />New Group
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <ModifierGroupCard
              key={group.id}
              group={group}
              restaurantId={restaurantId}
              onEditGroup={(g) => setGroupDialog({ open: true, group: g })}
              onDeleteGroup={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {groupDialog.open && (
        <GroupDialog
          group={groupDialog.group}
          onClose={() => setGroupDialog({ open: false, group: null })}
          onSave={handleGroupSave}
          loading={groupSaving}
        />
      )}

      {deleteTarget && (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-md" aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Delete Modifier Group</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">
              Delete <span className="font-semibold">&ldquo;{deleteTarget.name}&rdquo;</span> and all{' '}
              {deleteTarget.modifiers.length} option{deleteTarget.modifiers.length !== 1 ? 's' : ''} inside?
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button
                variant="destructive"
                loading={deleteGroupMutation.isPending}
                onClick={() => deleteGroupMutation.mutate(deleteTarget.id)}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ItemsPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const [activeTab, setActiveTab] = useState<Tab>('items')

  const { data: categories = [] } = useQuery({
    queryKey: ['menu', 'categories', restaurantId],
    queryFn: () => menuApi.listCategories(restaurantId),
    enabled: !!restaurantId,
  })

  return (
    <PageShell
      title="Items & Modifiers"
      breadcrumbs={[{ label: 'Menu' }, { label: 'Items & Modifiers' }]}
    >
      {!restaurantId ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No restaurant linked to your account.
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs active={activeTab} onChange={setActiveTab} />
          {activeTab === 'items' ? (
            <ItemsTab restaurantId={restaurantId} categories={categories} />
          ) : (
            <ModifierGroupsTab restaurantId={restaurantId} />
          )}
        </>
      )}
    </PageShell>
  )
}
