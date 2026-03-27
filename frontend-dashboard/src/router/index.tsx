import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { lazy, Suspense } from 'react'

// Lazy-loaded pages
const LoginPage           = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage        = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage  = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage   = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const PinLoginPage        = lazy(() => import('@/pages/auth/PinLoginPage'))
const TwoFactorPage       = lazy(() => import('@/pages/auth/TwoFactorPage'))
const DashboardPage       = lazy(() => import('@/pages/DashboardPage'))
const ComingSoonPage      = lazy(() => import('@/pages/ComingSoonPage'))
const CategoriesPage      = lazy(() => import('@/pages/menu/CategoriesPage'))
const ItemsPage           = lazy(() => import('@/pages/menu/ItemsPage'))
const ItemDetailPage      = lazy(() => import('@/pages/menu/ItemDetailPage'))
const POSPage             = lazy(() => import('@/pages/pos/POSPage'))
const KDSPage             = lazy(() => import('@/pages/kds/KDSPage'))
const OrdersPage          = lazy(() => import('@/pages/orders/OrdersPage'))
const DeliveryPage        = lazy(() => import('@/pages/delivery/DeliveryPage'))
const ReportsPage         = lazy(() => import('@/pages/reports/ReportsPage'))
const InventoryPage       = lazy(() => import('@/pages/inventory/InventoryPage'))
const CRMPage             = lazy(() => import('@/pages/crm/CRMPage'))
const CustomersPage       = lazy(() => import('@/pages/customers/CustomersPage'))
const TablesPage          = lazy(() => import('@/pages/tables/TablesPage'))
const PaymentsPage        = lazy(() => import('@/pages/payments/PaymentsPage'))
const StaffPage           = lazy(() => import('@/pages/staff/StaffPage'))
const MultiLocationPage   = lazy(() => import('@/pages/multi-location/MultiLocationPage'))
const SettingsPage        = lazy(() => import('@/pages/settings/SettingsPage'))
const BillingPage         = lazy(() => import('@/pages/billing/BillingPage'))
const OnboardingPage         = lazy(() => import('@/pages/onboarding/OnboardingPage'))
const CustomerDisplayPage    = lazy(() => import('@/pages/display/CustomerDisplayPage'))

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-surface-muted">
      <div className="flex items-center gap-3 text-gray-500">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading…
      </div>
    </div>
  )
}

function Page({ component: Component }: { component: React.LazyExoticComponent<() => JSX.Element> }) {
  return (
    <Suspense fallback={<Loading />}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  // ─── Onboarding (protected but outside AppLayout shell) ───────────────────
  {
    path: '/onboarding',
    element: <Page component={OnboardingPage} />,
  },

  // ─── Public display screen (no auth) ──────────────────────────────────────
  {
    path: '/display/:restaurantId',
    element: <Page component={CustomerDisplayPage} />,
  },

  // ─── Public / Auth routes ──────────────────────────────────────────────────
  {
    path: '/login',
    element: <Page component={LoginPage} />,
  },
  {
    path: '/auth/register',
    element: <Page component={RegisterPage} />,
  },
  {
    path: '/auth/forgot-password',
    element: <Page component={ForgotPasswordPage} />,
  },
  {
    path: '/auth/reset-password',
    element: <Page component={ResetPasswordPage} />,
  },
  {
    path: '/auth/pin',
    element: <Page component={PinLoginPage} />,
  },
  {
    path: '/auth/2fa',
    element: <Page component={TwoFactorPage} />,
  },

  // ─── Protected app routes ──────────────────────────────────────────────────
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Page component={DashboardPage} /> },

      // M3 — Menu
      { path: 'menu',                   element: <Page component={CategoriesPage} /> },
      { path: 'menu/categories',        element: <Page component={CategoriesPage} /> },
      { path: 'menu/items',             element: <Page component={ItemsPage} /> },
      { path: 'menu/items/:itemId',     element: <Page component={ItemDetailPage} /> },

      // M5 — POS
      { path: 'pos',             element: <Page component={POSPage} /> },

      // M6 — KDS
      { path: 'kds',             element: <Page component={KDSPage} /> },

      // M7 — Tables
      { path: 'tables',          element: <Page component={TablesPage} /> },

      // M4/M16 — Orders
      { path: 'orders',          element: <Page component={OrdersPage} /> },
      { path: 'orders/:id',      element: <Page component={OrdersPage} /> },

      // M18 — Delivery
      { path: 'delivery',        element: <Page component={DeliveryPage} /> },

      // M20 — Inventory
      { path: 'inventory',       element: <Page component={InventoryPage} /> },

      // M8 — Customers
      { path: 'customers',       element: <Page component={CustomersPage} /> },

      // M21 — CRM & Loyalty
      { path: 'crm',             element: <Page component={CRMPage} /> },

      // M7 — Payments
      { path: 'payments',        element: <Page component={PaymentsPage} /> },

      // M19 — Reports
      { path: 'reports',         element: <Page component={ReportsPage} /> },

      // M22 — Staff & HR
      { path: 'staff',           element: <Page component={StaffPage} /> },
      // M24 — Multi-Location
      { path: 'multi-location',  element: <Page component={MultiLocationPage} /> },

      // M2 — Settings
      { path: 'settings',          element: <Page component={SettingsPage} /> },
      { path: 'settings/:section', element: <Page component={SettingsPage} /> },

      // SaaS Billing
      { path: 'billing', element: <Page component={BillingPage} /> },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
