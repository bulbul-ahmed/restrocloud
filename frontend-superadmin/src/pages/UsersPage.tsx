import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus, UserX } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { listSuperAdmins, createSuperAdmin, deactivateSuperAdmin } from '@/lib/superadmin.api'
import { apiError } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { SuperAdminUserRow, SARole } from '@/types/superadmin.types'
import { SA_ROLES } from '@/types/superadmin.types'

// ─── Role display helpers ─────────────────────────────────────────────────────

const ROLE_LABELS: Record<SARole, string> = {
  PLATFORM_OWNER:   'Platform Owner',
  SUPER_ADMIN:      'Super Admin',
  FINANCE_ADMIN:    'Finance Admin',
  SUPPORT_MANAGER:  'Support Manager',
  SUPPORT_AGENT:    'Support Agent',
  ENGINEERING_ADMIN:'Engineering Admin',
}

const ROLE_COLORS: Record<SARole, string> = {
  PLATFORM_OWNER:    'bg-purple-600/20 text-purple-400',
  SUPER_ADMIN:       'bg-brand/20 text-brand',
  FINANCE_ADMIN:     'bg-green-600/20 text-green-400',
  SUPPORT_MANAGER:   'bg-blue-600/20 text-blue-400',
  SUPPORT_AGENT:     'bg-cyan-600/20 text-cyan-400',
  ENGINEERING_ADMIN: 'bg-orange-600/20 text-orange-400',
}

const ROLE_SCOPE: Record<SARole, string> = {
  PLATFORM_OWNER:    'Full access + billing control',
  SUPER_ADMIN:       'Full platform access',
  FINANCE_ADMIN:     'Finance dashboards only',
  SUPPORT_MANAGER:   'Tickets + announcements (manage)',
  SUPPORT_AGENT:     'Tickets + announcements (view/reply)',
  ENGINEERING_ADMIN: 'Feature flags only',
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const [users, setUsers] = useState<SuperAdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'SUPER_ADMIN' as SARole })
  const [adding, setAdding] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    try {
      const list = await listSuperAdmins()
      setUsers(list)
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function validateForm() {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.email.includes('@')) e.email = 'Valid email required'
    if (form.password.length < 8) e.password = 'Minimum 8 characters'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate() {
    if (!validateForm()) return
    setAdding(true)
    try {
      await createSuperAdmin(form)
      toast.success('Admin user created')
      setAddOpen(false)
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'SUPER_ADMIN' })
      setErrors({})
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setAdding(false)
    }
  }

  async function handleDeactivate(u: SuperAdminUserRow) {
    setBusy((b) => ({ ...b, [u.id]: true }))
    try {
      await deactivateSuperAdmin(u.id)
      toast.success(`${u.email} deactivated`)
      load()
    } catch (err) {
      toast.error(apiError(err))
    } finally {
      setBusy((b) => ({ ...b, [u.id]: false }))
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Users</h1>
          <p className="text-gray-500 mt-1">Manage platform administrator accounts and roles</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          Add Admin User
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Last Login</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Created</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="h-4 animate-pulse bg-gray-100 rounded" />
                        </td>
                      </tr>
                    ))
                  : users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                          {u.id === currentUser?.id && (
                            <p className="text-xs text-brand">You</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                            {ROLE_LABELS[u.role] ?? u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.isActive ? 'success' : 'secondary'}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={u.id === currentUser?.id || !u.isActive || busy[u.id]}
                            loading={busy[u.id]}
                            onClick={() => handleDeactivate(u)}
                            title={u.id === currentUser?.id ? 'Cannot deactivate your own account' : 'Deactivate'}
                          >
                            <UserX size={14} />
                            Deactivate
                          </Button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => {
        setAddOpen(o)
        if (!o) { setErrors({}); setForm({ firstName: '', lastName: '', email: '', password: '', role: 'SUPER_ADMIN' }) }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Jane" />
                {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
                {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="admin@restrocloud.com" />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as SARole }))}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SA_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{ROLE_SCOPE[form.role]}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button loading={adding} onClick={handleCreate}>Create Admin</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
