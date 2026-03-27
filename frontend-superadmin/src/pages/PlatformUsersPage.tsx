import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserCheck, KeyRound, ChevronRight, X, History, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { listPlatformUsers, getPlatformUser, resetUserPassword, unlockUser, getUserLoginHistory } from '@/lib/superadmin.api'
import type { PlatformUser } from '@/types/superadmin.types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

const ROLE_COLORS: Record<string, string> = {
  OWNER:            'bg-purple-600/20 text-purple-400',
  MANAGER:          'bg-blue-600/20 text-blue-400',
  CASHIER:          'bg-cyan-600/20 text-cyan-400',
  WAITER:           'bg-green-600/20 text-green-400',
  KITCHEN:          'bg-orange-600/20 text-orange-400',
  DRIVER:           'bg-yellow-600/20 text-yellow-400',
  STAFF:            'bg-slate-600/20 text-slate-400',
  SUPER_ADMIN:      'bg-brand/20 text-brand',
  PLATFORM_OWNER:   'bg-red-600/20 text-red-400',
  FINANCE_ADMIN:    'bg-emerald-600/20 text-emerald-400',
  SUPPORT_MANAGER:  'bg-indigo-600/20 text-indigo-400',
  SUPPORT_AGENT:    'bg-sky-600/20 text-sky-400',
  ENGINEERING_ADMIN:'bg-amber-600/20 text-amber-400',
}

// ─── User Detail Drawer ───────────────────────────────────────────────────────

type DrawerTab = 'details' | 'history'

function LoginHistoryTab({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['login-history', userId],
    queryFn: () => getUserLoginHistory(userId, 1, 50),
  })
  const entries = data?.data ?? []

  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading…</div>
  if (!entries.length) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <History size={28} className="mx-auto mb-2 opacity-30" />No login history yet.
    </div>
  )

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">{data?.pagination.total} event{data?.pagination.total !== 1 ? 's' : ''} (last 50 shown)</p>
      {entries.map((e: any) => (
        <div key={e.id} className={`flex items-start gap-3 p-3 rounded-lg border ${e.success ? 'border-green-600/20 bg-green-600/5' : 'border-red-600/20 bg-red-600/5'}`}>
          <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${e.success ? 'bg-green-400' : 'bg-red-400'}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium ${e.success ? 'text-green-400' : 'text-red-400'}`}>
              {e.success ? 'Successful login' : 'Failed attempt'}
            </p>
            {e.ipAddress && <p className="text-xs text-muted-foreground font-mono">{e.ipAddress}</p>}
            {e.deviceInfo && <p className="text-xs text-muted-foreground truncate">{e.deviceInfo}</p>}
          </div>
          <p className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(e.createdAt)}</p>
        </div>
      ))}
    </div>
  )
}

function UserDetailDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [showTemp, setShowTemp] = useState<string | null>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('details')

  const { data: user, isLoading } = useQuery({
    queryKey: ['platform-user', userId],
    queryFn: () => getPlatformUser(userId),
  })

  const resetMut = useMutation({
    mutationFn: () => resetUserPassword(userId),
    onSuccess: (res) => { setShowTemp(res.tempPassword); toast.success('Password reset') },
    onError: () => toast.error('Failed to reset password'),
  })

  const unlockMut = useMutation({
    mutationFn: () => unlockUser(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-user', userId] })
      qc.invalidateQueries({ queryKey: ['platform-users'] })
      toast.success('User unlocked')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Failed to unlock'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/40" onClick={onClose}>
      <div className="bg-card border-l border-border h-full w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">User Detail</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none"><X size={16} /></button>
        </div>

        {/* Drawer Tabs */}
        <div className="flex gap-1 p-2 border-b border-border">
          {([['details', 'Profile'], ['history', 'Login History']] as [DrawerTab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setDrawerTab(key)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${drawerTab === key ? 'bg-sidebar-active text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Loading…</div>
        ) : user ? (
          <div className="flex-1 overflow-y-auto p-5">
            {drawerTab === 'details' && (
              <div className="space-y-5">
                {/* Identity */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-brand/20 flex items-center justify-center text-brand font-bold text-sm">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-muted-foreground">{user.email ?? user.phone ?? '—'}</p>
                    </div>
                    <span className={`ml-auto text-xs px-2 py-0.5 rounded-md font-medium ${user.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLORS[user.role] ?? 'bg-slate-600/20 text-slate-400'}`}>
                    {user.role.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Details grid */}
                <div className="space-y-2 text-sm">
                  {[
                    { label: 'Tenant', value: user.tenant ? `${user.tenant.name} (${user.tenant.plan})` : '—' },
                    { label: 'Restaurant', value: user.restaurant?.name ?? '—' },
                    { label: 'Phone', value: user.phone ?? '—' },
                    { label: 'Verified', value: user.isVerified ? 'Yes' : 'No' },
                    { label: 'Last Login', value: fmtDate(user.lastLoginAt) },
                    { label: 'Created', value: fmtDate(user.createdAt) },
                    { label: 'User ID', value: <span className="font-mono text-xs">{user.id}</span> },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-muted-foreground flex-shrink-0">{label}</span>
                      <span className="text-foreground text-right">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Temp password result */}
                {showTemp && (
                  <div className="bg-yellow-600/10 border border-yellow-600/30 rounded-lg p-3 space-y-1">
                    <p className="text-xs text-yellow-400 font-medium">Temporary Password</p>
                    <p className="font-mono text-sm text-foreground break-all">{showTemp}</p>
                    <p className="text-xs text-muted-foreground">Share this securely. User must change on next login.</p>
                    <button onClick={() => setShowTemp(null)} className="text-xs text-muted-foreground hover:text-foreground mt-1">Dismiss</button>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <button
                    onClick={() => { if (confirm('Reset this user\'s password?')) resetMut.mutate() }}
                    disabled={resetMut.isPending}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-sidebar-active border border-border rounded-lg text-sm text-foreground hover:bg-sidebar-hover transition-colors disabled:opacity-50"
                  >
                    <KeyRound size={14} className="text-orange-400" />
                    Reset Password
                  </button>
                  {!user.isActive && (
                    <button
                      onClick={() => unlockMut.mutate()}
                      disabled={unlockMut.isPending}
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-green-600/10 border border-green-600/30 rounded-lg text-sm text-green-400 hover:bg-green-600/20 transition-colors disabled:opacity-50"
                    >
                      <UserCheck size={14} />
                      Unlock / Reactivate User
                    </button>
                  )}
                </div>
              </div>
            )}

            {drawerTab === 'history' && <LoginHistoryTab userId={userId} />}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">User not found</div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlatformUsersPage() {
  const [search, setSearch] = useState('')
  const [phone, setPhone] = useState('')
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)

  const params = {
    search: search || undefined,
    phone: phone || undefined,
    isActive: activeFilter === '' ? undefined : activeFilter === 'true',
    page,
    limit: 25,
  }

  const { data, isLoading } = useQuery({
    queryKey: ['platform-users', params],
    queryFn: () => listPlatformUsers(params),
    placeholderData: prev => prev,
  })

  const users: PlatformUser[] = data?.data ?? []
  const pagination = data?.pagination

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value)
    setPhone('')
    setPage(1)
  }

  function handlePhoneSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(e.target.value)
    setSearch('')
    setPage(1)
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Platform Users</h1>
        <p className="text-sm text-muted-foreground mt-1">Search and manage all users across all tenants</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={handleSearch}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div className="relative w-44">
          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={phone}
            onChange={handlePhoneSearch}
            placeholder="Phone number…"
            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <select
          value={activeFilter}
          onChange={e => { setActiveFilter(e.target.value as '' | 'true' | 'false'); setPage(1) }}
          className="bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {pagination && (
          <span className="text-sm text-muted-foreground ml-auto">{pagination.total.toLocaleString()} user{pagination.total !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No users found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-sidebar-active text-muted-foreground text-xs">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email / Phone</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Tenant</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Last Login</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-sidebar-hover transition-colors cursor-pointer" onClick={() => setDetailId(u.id)}>
                  <td className="px-4 py-3 font-medium text-foreground">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{u.email ?? u.phone ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLORS[u.role] ?? 'bg-slate-600/20 text-slate-400'}`}>
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{u.tenant?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md ${u.isActive ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{fmtDate(u.lastLoginAt)}</td>
                  <td className="px-4 py-3 text-right"><ChevronRight size={14} className="text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page} of {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
            className="px-3 py-1.5 text-sm border border-border rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors">
            Next
          </button>
        </div>
      )}

      {detailId && <UserDetailDrawer userId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
