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
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui.store'
import { useAuthStore } from '@/store/auth.store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { getInitials } from '@/lib/utils'
import { api } from '@/lib/api'
import { disconnectSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/lib/settings.api'

// Roles hierarchy for reference:
// OWNER > MANAGER > CASHIER / WAITER / KITCHEN / DRIVER / STAFF
const MANAGER_UP  = ['OWNER', 'MANAGER']
const CASHIER_UP  = ['OWNER', 'MANAGER', 'CASHIER']
const ALL_FLOOR   = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER']
const KDS_ROLES   = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']
const ORDERS_VIEW = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN']
const DELIVERY_ROLES = ['OWNER', 'MANAGER', 'DRIVER']

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
  roles?: string[]   // undefined = all authenticated roles
}

interface NavSection {
  title: string
  items: NavItem[]
  roles?: string[]   // section-level guard (hides entire section if user has no visible items)
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
      { label: 'Point of Sale',    href: '/pos',       icon: Monitor,       roles: CASHIER_UP },
      { label: 'Kitchen Display',  href: '/kds',       icon: ChefHat,       roles: KDS_ROLES },
      { label: 'Tables',           href: '/tables',    icon: Grid3X3,       roles: ALL_FLOOR },
      { label: 'Orders',           href: '/orders',    icon: ClipboardList, roles: ORDERS_VIEW },
      { label: 'Delivery',         href: '/delivery',  icon: Truck,         roles: DELIVERY_ROLES },
      { label: 'Inventory',        href: '/inventory', icon: Package,       roles: MANAGER_UP },
    ],
  },
  {
    title: 'Menu',
    items: [
      { label: 'Categories',        href: '/menu/categories', icon: FolderOpen,       roles: MANAGER_UP },
      { label: 'Items & Modifiers', href: '/menu/items',      icon: UtensilsCrossed,  roles: MANAGER_UP },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', href: '/payments', icon: CreditCard, roles: CASHIER_UP },
      { label: 'Reports',  href: '/reports',  icon: BarChart3,  roles: MANAGER_UP },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Multi-Location', href: '/multi-location', icon: Building2, roles: MANAGER_UP },
      { label: 'Customers',      href: '/customers',      icon: Users,     roles: CASHIER_UP },
      { label: 'CRM & Loyalty',  href: '/crm',            icon: Heart,     roles: MANAGER_UP },
      { label: 'Staff',          href: '/staff',          icon: Users,     roles: MANAGER_UP },
      { label: 'Billing',        href: '/billing',        icon: CreditCard,roles: MANAGER_UP },
      { label: 'Settings',       href: '/settings',       icon: Settings,  roles: MANAGER_UP },
    ],
  },
]

export function Sidebar() {
  const location = useLocation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, logout } = useAuthStore()
  const restaurantId = user?.restaurantId ?? ''

  const { data: restaurantInfo } = useQuery({
    queryKey: ['sidebar-restaurant', restaurantId],
    queryFn: () => settingsApi.get(restaurantId),
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  })

  async function handleLogout() {
    try {
      const { refreshToken } = useAuthStore.getState()
      if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {})
    } finally {
      disconnectSocket()
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
        {restaurantInfo?.logoUrl ? (
          <img
            src={restaurantInfo.logoUrl}
            alt={restaurantInfo.name}
            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white font-bold text-sm flex-shrink-0">
            {(restaurantInfo?.name ?? 'R')[0].toUpperCase()}
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sidebar-textActive text-sm font-semibold leading-tight truncate">
              {restaurantInfo?.name ?? 'RestroCloud'}
            </span>
            <span className="text-sidebar-textMuted text-xs truncate">
              {user?.role ?? 'Dashboard'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 sidebar-scroll">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(
            item => !item.roles || item.roles.includes(user?.role ?? '')
          )
          if (visibleItems.length === 0) return null
          return (
          <div key={section.title} className="mb-4">
            {!sidebarCollapsed && (
              <p className="px-4 mb-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-textMuted">
                {section.title}
              </p>
            )}
            {visibleItems.map((item) => {
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
                      isActive ? 'text-brand' : 'text-sidebar-text group-hover:text-sidebar-textActive',
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
          )
        })}
      </nav>

      {/* Powered by */}
      {!sidebarCollapsed && (
        <div className="px-4 pb-2 text-center">
          <p className="text-[10px] text-sidebar-textMuted opacity-40">Powered by RestroCloud</p>
        </div>
      )}

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
