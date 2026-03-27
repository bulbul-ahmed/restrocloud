import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'

const LoginPage      = lazy(() => import('@/pages/auth/LoginPage'))
const DashboardPage  = lazy(() => import('@/pages/DashboardPage'))
const TenantsPage    = lazy(() => import('@/pages/TenantsPage'))
const AnalyticsPage  = lazy(() => import('@/pages/AnalyticsPage'))
const AuditLogPage   = lazy(() => import('@/pages/AuditLogPage'))
const UsersPage      = lazy(() => import('@/pages/UsersPage'))
const FinancePage        = lazy(() => import('@/pages/FinancePage'))
const FeatureFlagsPage   = lazy(() => import('@/pages/FeatureFlagsPage'))
const SupportPage          = lazy(() => import('@/pages/SupportPage'))
const PlatformUsersPage    = lazy(() => import('@/pages/PlatformUsersPage'))
const BillingPage          = lazy(() => import('@/pages/BillingPage'))
const IntelligencePage     = lazy(() => import('@/pages/IntelligencePage'))
const SystemPage           = lazy(() => import('@/pages/SystemPage'))
const MarketingPage        = lazy(() => import('@/pages/MarketingPage'))
const PlansPage            = lazy(() => import('@/pages/PlansPage'))
const KnowledgeBasePage    = lazy(() => import('@/pages/KnowledgeBasePage'))

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-950">
      <svg className="animate-spin h-8 w-8 text-brand" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

function Page({ component: C }: { component: React.LazyExoticComponent<() => JSX.Element> }) {
  return <Suspense fallback={<Loading />}><C /></Suspense>
}

export const router = createBrowserRouter([
  { path: '/login', element: <Page component={LoginPage} /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',  element: <Page component={DashboardPage} /> },
      { path: 'tenants',    element: <Page component={TenantsPage} /> },
      { path: 'analytics',  element: <Page component={AnalyticsPage} /> },
      { path: 'audit',      element: <Page component={AuditLogPage} /> },
      { path: 'users',      element: <Page component={UsersPage} /> },
      { path: 'finance',        element: <Page component={FinancePage} /> },
      { path: 'feature-flags',  element: <Page component={FeatureFlagsPage} /> },
      { path: 'support',          element: <Page component={SupportPage} /> },
      { path: 'platform-users',   element: <Page component={PlatformUsersPage} /> },
      { path: 'billing',          element: <Page component={BillingPage} /> },
      { path: 'intelligence',     element: <Page component={IntelligencePage} /> },
      { path: 'system',           element: <Page component={SystemPage} /> },
      { path: 'marketing',        element: <Page component={MarketingPage} /> },
      { path: 'plans',            element: <Page component={PlansPage} /> },
      { path: 'knowledge-base',   element: <Page component={KnowledgeBasePage} /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
