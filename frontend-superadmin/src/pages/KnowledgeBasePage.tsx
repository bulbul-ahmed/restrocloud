import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listKbArticles, createKbArticle, updateKbArticle, deleteKbArticle } from '@/lib/superadmin.api'
import type { KbArticle, CreateKbArticlePayload } from '@/types/superadmin.types'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Eye, EyeOff, BookOpen, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const CATEGORIES = ['general', 'billing', 'menu', 'orders', 'pos', 'integrations', 'account', 'troubleshooting']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { dateStyle: 'medium' })
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

// ─── Article Editor ───────────────────────────────────────────────────────────

function ArticleEditor({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: Partial<KbArticle>
  onSave: (p: CreateKbArticlePayload) => void
  onCancel: () => void
  saving: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [slug, setSlug] = useState(initial?.slug ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [category, setCategory] = useState(initial?.category ?? 'general')
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false)
  const [preview, setPreview] = useState(false)

  const autoSlug = slugify(title)
  const effectiveSlug = slug || autoSlug

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Title + meta row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Title <span className="text-red-400">*</span></label>
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); if (!initial?.slug) setSlug('') }}
            placeholder="Getting started with your dashboard"
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Slug <span className="text-slate-500 font-normal">(auto-generated)</span></label>
          <input
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder={autoSlug || 'getting-started-with-dashboard'}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand capitalize">
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-4">
          <input type="checkbox" className="accent-brand" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
          <span className="text-sm text-foreground">Published</span>
        </label>
        <div className="ml-auto flex items-center gap-2 mt-4">
          <button onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5">
            <Eye size={12} /> {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Body / Preview */}
      <div className="flex-1 min-h-0">
        <label className="text-xs text-muted-foreground mb-1 block">Body (Markdown)</label>
        {preview ? (
          <div className="h-64 overflow-y-auto bg-input border border-border rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap font-mono leading-relaxed">
            {body || <span className="text-muted-foreground italic">Nothing to preview…</span>}
          </div>
        ) : (
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={12}
            placeholder={'# Getting Started\n\nWrite your article in Markdown format.\n\n## Section 1\n\nContent here…'}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Public URL: <span className="font-mono text-brand-400">GET /kb/{effectiveSlug}</span>
        {!isPublished && <span className="ml-2 text-amber-400">(draft — not visible publicly)</span>}
      </p>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
        <button
          onClick={() => onSave({ title, slug: slug || undefined, body, category, isPublished })}
          disabled={!title.trim() || !body.trim() || saving}
          className="px-5 py-2 bg-brand hover:bg-brand/90 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : initial?.id ? 'Update Article' : 'Create Article'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editing, setEditing] = useState<KbArticle | null | 'new'>(null)

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['kb-articles'],
    queryFn: () => listKbArticles(),
  })

  const createMut = useMutation({
    mutationFn: createKbArticle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-articles'] }); setEditing(null); toast.success('Article created') },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to create'),
  })

  const updateMut = useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: any }) => updateKbArticle(slug, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-articles'] }); setEditing(null); toast.success('Article updated') },
    onError: () => toast.error('Failed to update'),
  })

  const deleteMut = useMutation({
    mutationFn: deleteKbArticle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb-articles'] }); toast.success('Article deleted') },
    onError: () => toast.error('Failed to delete'),
  })

  const togglePublish = (article: KbArticle) =>
    updateMut.mutate({ slug: article.slug, payload: { isPublished: !article.isPublished } })

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || a.category === catFilter
    return matchSearch && matchCat
  })

  const grouped = CATEGORIES.reduce<Record<string, KbArticle[]>>((acc, cat) => {
    const items = filtered.filter(a => a.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  if (editing) {
    const isNew = editing === 'new'
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground transition-colors text-sm">← Back</button>
          <h1 className="text-xl font-semibold text-white">{isNew ? 'New Article' : `Edit: ${(editing as KbArticle).title}`}</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <ArticleEditor
            initial={isNew ? undefined : editing as KbArticle}
            saving={createMut.isPending || updateMut.isPending}
            onCancel={() => setEditing(null)}
            onSave={payload => {
              if (isNew) createMut.mutate(payload)
              else updateMut.mutate({ slug: (editing as KbArticle).slug, payload })
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Help articles for restaurant dashboard users — published articles available at <span className="font-mono text-brand-400">GET /kb/:slug</span></p>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors">
          <Plus size={14} /> New Article
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search articles…"
            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p>No articles yet. Create your first one.</p>
        </div>
      )}

      {/* Grouped articles */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </h2>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border">
                  {items.map(article => (
                    <tr key={article.id} className="hover:bg-sidebar-hover transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">{article.title}</p>
                          {!article.isPublished && (
                            <span className="text-xs bg-amber-600/20 text-amber-400 px-1.5 py-0.5 rounded">Draft</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{article.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground w-32">Updated {fmtDate(article.updatedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground w-28">{article.authorEmail.split('@')[0]}</td>
                      <td className="px-4 py-3 w-32">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => togglePublish(article)} title={article.isPublished ? 'Unpublish' : 'Publish'}
                            className={cn('p-1.5 rounded transition-colors', article.isPublished ? 'text-green-400 hover:bg-green-600/20' : 'text-slate-500 hover:bg-slate-600/20')}>
                            {article.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button onClick={() => setEditing(article)} title="Edit"
                            className="p-1.5 rounded text-muted-foreground hover:text-brand hover:bg-brand/10 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => { if (confirm('Delete this article?')) deleteMut.mutate(article.slug) }}
                            title="Delete"
                            className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-600/10 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
