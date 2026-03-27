import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, MoreHorizontal, FolderOpen } from 'lucide-react'

import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { Category } from '@/types/menu.types'

// ─── Form schema ──────────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

const updateSchema = createSchema.extend({
  isActive: z.boolean(),
})

type CreateForm = z.infer<typeof createSchema>
type UpdateForm = z.infer<typeof updateSchema>

// ─── Category form dialog ─────────────────────────────────────────────────────

function CategoryDialog({
  category,
  onClose,
  onSave,
  loading,
}: {
  category: Category | null
  onClose: () => void
  onSave: (data: CreateForm | UpdateForm) => void
  loading: boolean
}) {
  const isEdit = !!category

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UpdateForm>({
    resolver: zodResolver(isEdit ? updateSchema : createSchema),
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      imageUrl: category?.imageUrl ?? '',
      isActive: category?.isActive ?? true,
    },
  })

  const isActive = watch('isActive')

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSave)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cat-name"
              placeholder="e.g. Starters, Main Course…"
              {...register('name')}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              placeholder="Brief description for this category…"
              rows={2}
              {...register('description')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-image">Image URL</Label>
            <Input
              id="cat-image"
              type="url"
              placeholder="https://…"
              {...register('imageUrl')}
            />
            {errors.imageUrl && <p className="text-xs text-red-500">{errors.imageUrl.message}</p>}
          </div>

          {/* Active toggle only available when editing */}
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-surface-subtle">
              <div>
                <p className="text-sm font-medium text-gray-700">Active</p>
                <p className="text-xs text-gray-500">Inactive categories are hidden from menus</p>
              </div>
              <Switch
                checked={isActive ?? true}
                onCheckedChange={(v) => setValue('isActive', v)}
              />
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={loading}>
              {isEdit ? 'Save Changes' : 'Create Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  onEdit,
  onDelete,
  onToggleActive,
  toggling,
}: {
  category: Category
  onEdit: (c: Category) => void
  onDelete: (c: Category) => void
  onToggleActive: (c: Category, active: boolean) => void
  toggling: boolean
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border bg-white hover:bg-surface-subtle transition-colors group">
      {/* Image / placeholder */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-surface-subtle border border-border overflow-hidden flex items-center justify-center">
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <FolderOpen size={20} className="text-gray-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{category.name}</span>
          <Badge variant={category.isActive ? 'success' : 'secondary'} className="text-2xs">
            {category.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        {category.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{category.description}</p>
        )}
      </div>

      {/* Item count */}
      <div className="flex-shrink-0 text-right">
        <span className="text-sm font-semibold text-gray-700">
          {category._count?.items ?? 0}
        </span>
        <p className="text-2xs text-gray-400">items</p>
      </div>

      {/* Active switch */}
      <Switch
        checked={category.isActive}
        onCheckedChange={(v) => onToggleActive(category, v)}
        disabled={toggling}
      />

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(category)}>
            <Pencil size={14} />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(category)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 size={14} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { user } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''
  const qc = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)

  // ── Fetch categories ────────────────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['menu', 'categories', restaurantId],
    queryFn: () => menuApi.listCategories(restaurantId),
    enabled: !!restaurantId,
  })

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['menu', 'categories', restaurantId] })

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (dto: Parameters<typeof menuApi.createCategory>[1]) =>
      menuApi.createCategory(restaurantId, dto),
    onSuccess: () => {
      toast.success('Category created')
      setDialogOpen(false)
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Parameters<typeof menuApi.updateCategory>[2] }) =>
      menuApi.updateCategory(restaurantId, id, dto),
    onSuccess: () => {
      toast.success('Category updated')
      setDialogOpen(false)
      setEditTarget(null)
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => menuApi.deleteCategory(restaurantId, id),
    onSuccess: () => {
      toast.success('Category deleted')
      setDeleteTarget(null)
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      menuApi.updateCategory(restaurantId, id, { isActive }),
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? 'Category activated' : 'Category deactivated')
      invalidate()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleSave(form: CreateForm | UpdateForm) {
    const base = {
      name: form.name,
      description: form.description || undefined,
      imageUrl: form.imageUrl || undefined,
    }
    if (editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        dto: { ...base, isActive: (form as UpdateForm).isActive },
      })
    } else {
      createMutation.mutate(base) // isActive not sent on create
    }
  }

  const saving = createMutation.isPending || updateMutation.isPending

  return (
    <PageShell
      title="Categories"
      breadcrumbs={[{ label: 'Menu' }, { label: 'Categories' }]}
      actions={
        <Button
          onClick={() => { setEditTarget(null); setDialogOpen(true) }}
          disabled={!restaurantId}
        >
          <Plus size={16} />
          Add Category
        </Button>
      }
    >
      {!restaurantId && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            No restaurant linked to your account.
          </CardContent>
        </Card>
      )}

      {restaurantId && isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-subtle animate-pulse border border-border" />
          ))}
        </div>
      )}

      {restaurantId && !isLoading && categories.length === 0 && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-surface-subtle">
              <FolderOpen size={28} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900">No categories yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Create your first category to start building your menu.
              </p>
            </div>
            <Button
              onClick={() => { setEditTarget(null); setDialogOpen(true) }}
              className="mt-2"
            >
              <Plus size={16} />
              Add Category
            </Button>
          </CardContent>
        </Card>
      )}

      {restaurantId && !isLoading && categories.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-500 mb-3">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </p>
          {categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onEdit={(c) => { setEditTarget(c); setDialogOpen(true) }}
              onDelete={setDeleteTarget}
              onToggleActive={(c, active) =>
                toggleMutation.mutate({ id: c.id, isActive: active })
              }
              toggling={toggleMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <CategoryDialog
          category={editTarget}
          onClose={() => { setDialogOpen(false); setEditTarget(null) }}
          onSave={handleSave}
          loading={saving}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Dialog open onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Category</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Delete{' '}
              <span className="font-semibold">&ldquo;{deleteTarget.name}&rdquo;</span>?
              {(deleteTarget._count?.items ?? 0) > 0 && (
                <span className="block mt-2 text-amber-700 bg-amber-50 rounded-md px-3 py-2 text-xs">
                  This category has {deleteTarget._count!.items} item
                  {deleteTarget._count!.items !== 1 ? 's' : ''}. Deleting it may unlink those items.
                </span>
              )}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
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
    </PageShell>
  )
}
