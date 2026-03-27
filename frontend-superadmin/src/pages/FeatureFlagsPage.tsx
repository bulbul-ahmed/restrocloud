import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, Plus, Trash2, ToggleLeft, ToggleRight, Search } from 'lucide-react'
import { toast } from 'sonner'
import {
  listFeatureFlags,
  setFeatureFlag,
  deleteFeatureFlag,
  getTenantFeatureOverrides,
  setTenantFeatureOverride,
  deleteTenantFeatureOverride,
  listTenants,
} from '@/lib/superadmin.api'
import type { FeatureFlag, TenantFeatureOverride, TenantRow } from '@/types/superadmin.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

// ─── Add Flag Dialog ──────────────────────────────────────────────────────────

function AddFlagDialog({ onClose, onSave }: { onClose: () => void; onSave: (f: { key: string; enabled: boolean; description: string }) => void }) {
  const [key, setKey] = useState('')
  const [desc, setDesc] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [err, setErr] = useState('')

  function submit() {
    if (!key.trim()) { setErr('Key is required'); return }
    if (!/^[a-z0-9_]+$/.test(key)) { setErr('Key must be lowercase letters, digits, or underscores'); return }
    onSave({ key: key.trim(), enabled, description: desc.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-foreground mb-4">Add Feature Flag</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Key (lowercase, underscores)</label>
            <input
              value={key}
              onChange={e => { setKey(e.target.value); setErr('') }}
              placeholder="e.g. new_dashboard_ui"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
            {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="What does this flag control?"
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-muted-foreground">Default state:</label>
            <button onClick={() => setEnabled(!enabled)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${enabled ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
              {enabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
          <button onClick={submit} className="px-4 py-2 text-sm bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors">Create Flag</button>
        </div>
      </div>
    </div>
  )
}

// ─── Global Flags Tab ─────────────────────────────────────────────────────────

function GlobalFlagsTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)

  const { data: flags = [], isLoading } = useQuery({
    queryKey: ['feature-flags'],
    queryFn: listFeatureFlags,
  })

  const setMut = useMutation({
    mutationFn: (payload: { key: string; enabled: boolean; description?: string }) => setFeatureFlag(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feature-flags'] }); setShowAdd(false); toast.success('Flag saved') },
    onError: () => toast.error('Failed to save flag'),
  })

  const delMut = useMutation({
    mutationFn: (key: string) => deleteFeatureFlag(key),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feature-flags'] }); toast.success('Flag deleted') },
    onError: () => toast.error('Failed to delete flag'),
  })

  function toggle(flag: FeatureFlag) {
    setMut.mutate({ key: flag.key, enabled: !flag.enabled, description: flag.description })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{flags.length} global flag{flags.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors"
        >
          <Plus size={14} /> Add Flag
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
      ) : flags.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Flag size={32} className="mx-auto mb-3 opacity-30" />
          No feature flags yet. Create one to control platform features.
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-active text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Key</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Last Updated</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flags.map(flag => (
                <tr key={flag.key} className="hover:bg-sidebar-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{flag.key}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{flag.description || '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(flag)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${flag.enabled ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'}`}
                    >
                      {flag.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                      {flag.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(flag.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm(`Delete flag "${flag.key}"?`)) delMut.mutate(flag.key) }}
                      className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <AddFlagDialog
          onClose={() => setShowAdd(false)}
          onSave={(f) => setMut.mutate(f)}
        />
      )}
    </div>
  )
}

// ─── Tenant Overrides Tab ─────────────────────────────────────────────────────

function TenantOverridesTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedTenant, setSelectedTenant] = useState<TenantRow | null>(null)
  const [addKey, setAddKey] = useState('')
  const [addEnabled, setAddEnabled] = useState(true)
  const [addErr, setAddErr] = useState('')

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants', search],
    queryFn: () => listTenants({ search, limit: 10 }),
    enabled: search.length > 0,
  })

  const tenants = tenantsData?.data ?? []

  const { data: overrides = [], isLoading: overridesLoading } = useQuery({
    queryKey: ['tenant-feature-overrides', selectedTenant?.id],
    queryFn: () => getTenantFeatureOverrides(selectedTenant!.id),
    enabled: !!selectedTenant,
  })

  const setMut = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      setTenantFeatureOverride(selectedTenant!.id, { key, enabled }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-feature-overrides', selectedTenant?.id] })
      setAddKey('')
      setAddErr('')
      toast.success('Override saved')
    },
    onError: () => toast.error('Failed to save override'),
  })

  const delMut = useMutation({
    mutationFn: (key: string) => deleteTenantFeatureOverride(selectedTenant!.id, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-feature-overrides', selectedTenant?.id] })
      toast.success('Override removed')
    },
    onError: () => toast.error('Failed to remove override'),
  })

  function addOverride() {
    if (!addKey.trim()) { setAddErr('Key is required'); return }
    if (!/^[a-z0-9_]+$/.test(addKey)) { setAddErr('Key must be lowercase letters, digits, or underscores'); return }
    setMut.mutate({ key: addKey.trim(), enabled: addEnabled })
  }

  return (
    <div className="space-y-5">
      {/* Tenant search */}
      <div>
        <label className="text-xs text-muted-foreground mb-1.5 block">Select Tenant</label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedTenant(null) }}
            placeholder="Search tenants by name…"
            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        {search.length > 0 && tenants.length > 0 && !selectedTenant && (
          <div className="mt-1 border border-border rounded-lg bg-card overflow-hidden shadow-lg">
            {tenants.map(t => (
              <button
                key={t.id}
                onClick={() => { setSelectedTenant(t); setSearch(t.name) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-sidebar-hover transition-colors"
              >
                <span className="text-foreground font-medium">{t.name}</span>
                <span className="text-muted-foreground text-xs">{t.slug}</span>
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded ${t.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                  {t.isActive ? 'Active' : 'Inactive'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTenant && (
        <div className="space-y-4">
          {/* Selected tenant badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-brand/10 border border-brand/20 rounded-lg">
            <Flag size={14} className="text-brand" />
            <span className="text-sm font-medium text-foreground">{selectedTenant.name}</span>
            <span className="text-xs text-muted-foreground">{selectedTenant.plan}</span>
          </div>

          {/* Add override row */}
          <div className="flex items-center gap-3">
            <input
              value={addKey}
              onChange={e => { setAddKey(e.target.value); setAddErr('') }}
              placeholder="flag_key"
              className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <button
              onClick={() => setAddEnabled(!addEnabled)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${addEnabled ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}
            >
              {addEnabled ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {addEnabled ? 'Enabled' : 'Disabled'}
            </button>
            <button onClick={addOverride} className="px-4 py-2 bg-brand text-white rounded-lg text-sm hover:bg-brand/90 transition-colors">
              Add
            </button>
          </div>
          {addErr && <p className="text-xs text-red-400 -mt-2">{addErr}</p>}

          {/* Overrides list */}
          {overridesLoading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">Loading…</div>
          ) : overrides.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No overrides for this tenant.</div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-sidebar-active text-muted-foreground text-xs">
                    <th className="px-4 py-3 text-left font-medium">Key</th>
                    <th className="px-4 py-3 text-left font-medium">Override</th>
                    <th className="px-4 py-3 text-left font-medium">Last Updated</th>
                    <th className="px-4 py-3 text-right font-medium">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overrides.map((ov: TenantFeatureOverride) => (
                    <tr key={ov.key} className="hover:bg-sidebar-hover transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{ov.key}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setMut.mutate({ key: ov.key, enabled: !ov.enabled })}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${ov.enabled ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'}`}
                        >
                          {ov.enabled ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          {ov.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(ov.updatedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => delMut.mutate(ov.key)}
                          className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                          title="Remove override"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'global' | 'tenant'

export default function FeatureFlagsPage() {
  const [tab, setTab] = useState<Tab>('global')

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Feature Flags</h1>
        <p className="text-sm text-muted-foreground mt-1">Control platform features globally or per-tenant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-sidebar-active rounded-lg w-fit">
        {(['global', 'tenant'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors capitalize ${tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'global' ? 'Global Flags' : 'Tenant Overrides'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        {tab === 'global' ? <GlobalFlagsTab /> : <TenantOverridesTab />}
      </div>
    </div>
  )
}
