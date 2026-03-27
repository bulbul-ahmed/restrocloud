import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Building2, BarChart3, Users, ShieldAlert, LogOut, Wallet, Flag, MessageSquare, UsersRound, CreditCard, BrainCircuit, Server, Megaphone, Layers, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { getInitials } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const NAV = [
  { label: 'Dashboard',          href: '/dashboard',  icon: LayoutDashboard },
  { label: 'Tenants',            href: '/tenants',    icon: Building2 },
  { label: 'Platform Analytics', href: '/analytics',  icon: BarChart3 },
  { label: 'Finance',            href: '/finance',    icon: Wallet },
  { label: 'Feature Flags',      href: '/feature-flags', icon: Flag },
  { label: 'Support',            href: '/support',        icon: MessageSquare },
  { label: 'Platform Users',     href: '/platform-users', icon: UsersRound },
  { label: 'Billing',            href: '/billing',        icon: CreditCard },
  { label: 'Plans',             href: '/plans',          icon: Layers },
  { label: 'Knowledge Base',    href: '/knowledge-base', icon: BookOpen },
  { label: 'Intelligence',       href: '/intelligence',   icon: BrainCircuit },
  { label: 'System',             href: '/system',         icon: Server },
  { label: 'Marketing',          href: '/marketing',      icon: Megaphone },
  { label: 'Audit Log',          href: '/audit',      icon: ShieldAlert },
  { label: 'Admin Users',        href: '/users',      icon: Users },
]

export function Sidebar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuthStore()

  async function handleLogout() {
    const { refreshToken } = useAuthStore.getState()
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
    logout()
    toast.success('Logged out')
  }

  return (
    <aside className="w-60 flex flex-col h-screen bg-sidebar-bg border-r border-sidebar-border flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-5 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white font-bold text-sm">
          RC
        </div>
        <div>
          <p className="text-sidebar-textActive text-sm font-semibold leading-tight">RestroCloud</p>
          <p className="text-sidebar-textMuted text-xs">Super Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-sidebar-active text-sidebar-textActive'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-textActive',
              )}
            >
              <Icon size={17} className={cn('flex-shrink-0', isActive ? 'text-brand-400' : '')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand text-white text-xs font-bold flex-shrink-0">
            {user ? getInitials(`${user.firstName} ${user.lastName}`) : 'SA'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sidebar-textActive text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-sidebar-textMuted text-xs truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-sidebar-textMuted hover:text-red-400 transition-colors p-1"
            title="Logout"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
