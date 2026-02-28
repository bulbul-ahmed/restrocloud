import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Monitor,
  ChefHat,
  Grid3X3,
  ClipboardList,
  FolderOpen,
  UtensilsCrossed,
  CreditCard,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Truck,
  Package,
  Heart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { getInitials } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Point of Sale', href: '/pos', icon: Monitor },
      { label: 'Kitchen Display', href: '/kds', icon: ChefHat },
      { label: 'Tables',   href: '/tables',   icon: Grid3X3     },
      { label: 'Orders',    href: '/orders',    icon: ClipboardList },
      { label: 'Delivery',  href: '/delivery',  icon: Truck       },
      { label: 'Inventory', href: '/inventory', icon: Package     },
    ],
  },
  {
    title: 'Menu',
    items: [
      { label: 'Categories', href: '/menu/categories', icon: FolderOpen },
      { label: 'Items & Modifiers', href: '/menu/items', icon: UtensilsCrossed },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', href: '/payments', icon: CreditCard },
      { label: 'Reports', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Customers', href: '/customers', icon: Users },
      { label: 'CRM & Loyalty', href: '/crm', icon: Heart },
      { label: 'Staff', href: '/staff', icon: Users },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()

  async function handleLogout() {
    try {
      const { refreshToken } = useAuthStore.getState()
      if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
    } finally {
      logout()
    }
    toast.success('Logged out successfully')
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen bg-sidebar-bg border-r border-sidebar-border transition-all duration-200 ease-in-out flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-sidebar-border flex-shrink-0',
        sidebarCollapsed ? 'justify-center' : 'gap-3',
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white font-bold text-sm flex-shrink-0">
          R
        </div>
        {!sidebarCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sidebar-textActive text-sm font-semibold leading-tight truncate">
              RestroCloud
            </span>
            <span className="text-sidebar-textMuted text-xs truncate">
              {user?.role ?? 'Dashboard'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 sidebar-scroll">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!sidebarCollapsed && (
              <p className="px-4 mb-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-textMuted">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive =
                item.href === '/dashboard'
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(item.href)

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors group',
                    isActive
                      ? 'bg-sidebar-active text-sidebar-textActive'
                      : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-textActive',
                    sidebarCollapsed && 'justify-center px-2',
                  )}
                >
                  <Icon
                    size={18}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      isActive ? 'text-brand-400' : 'text-sidebar-text group-hover:text-sidebar-textActive',
                    )}
                  />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="ml-auto text-2xs bg-brand text-white rounded-full px-1.5 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        <Separator className="bg-sidebar-border" />
        <div className={cn(
          'flex items-center gap-3 p-4',
          sidebarCollapsed && 'justify-center p-3',
        )}>
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-brand text-white text-xs">
              {user ? getInitials(`${user.firstName} ${user.lastName}`) : '?'}
            </AvatarFallback>
          </Avatar>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 overflow-hidden">
                <p className="text-sidebar-textActive text-sm font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-sidebar-textMuted text-xs truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="text-sidebar-textMuted hover:text-red-400 transition-colors p-1 rounded"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 flex items-center justify-center w-6 h-6 rounded-full bg-sidebar-bg border border-sidebar-border text-sidebar-text hover:text-sidebar-textActive shadow-sm transition-colors"
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </aside>
  )
}
