# RestroCloud — Super Admin Panel: TODO List

> Last updated: 2026-03-09
> Based on product doc §4 (Super Admin Panel — Platform Governance)
> Overall coverage: **~67%** (64/96 features built)

---

## Legend

- `✅ DONE` — Built, tested, frontend live
- `⚠️ PARTIAL` — Backend or frontend built, but incomplete
- `⏳ PENDING` — Not built yet, scoped and ready to build
- `BACKLOG` — Future work, out of scope for current stage

---

## Section 4.1 — Dashboard Overview

| # | Feature | Status |
|---|---------|--------|
| 4.1.1 | Active restaurants by plan / status | ✅ DONE |
| 4.1.2 | Orders today / this month (all restaurants) | ✅ DONE |
| 4.1.3 | GMV (gross merchandise value) | ✅ DONE |
| 4.1.4 | RestroCloud revenue (MRR / ARR) | ✅ DONE |
| 4.1.5 | New sign-ups today / this month | ✅ DONE |
| 4.1.6 | Trial conversion % | ✅ DONE |
| 4.1.7 | Churn rate (terminated this month vs last) | ✅ DONE |
| 4.1.8 | Active users right now (15-min session window) | ✅ DONE |
| 4.1.9 | System health (DB / Redis latency, error rates) | ✅ DONE |
| 4.1.10 | Support ticket volume / response times | ✅ DONE |

---

## Section A — Restaurant Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| A.1 | Restaurant directory — search, filter by name / plan / status / date | ✅ DONE | `GET /super-admin/tenants` with full filter support |
| A.2 | Restaurant detail view — profile, plan, billing, orders, tickets | ✅ DONE | `GET /super-admin/tenants/:id` — slide-in drawer in TenantsPage |
| A.3 | Impersonate login | ✅ DONE | 1-hour token, audit logged |
| A.4 | Suspend / activate account | ✅ DONE | Cascades to all users, flushes Redis instantly |
| A.5 | Upgrade / downgrade plan manually | ✅ DONE | `PATCH /tenants/:id/plan` |
| A.6 | Apply discounts / credits | ✅ DONE | `PATCH /tenants/:id/credit` |
| A.7 | Extend trial period | ✅ DONE | `PATCH /tenants/:id/extend-trial` |
| A.8 | Terminate account (soft delete) | ✅ DONE | Sets `terminatedAt`, excluded from all queries |
| A.9 | Flag for review | ✅ DONE | `PATCH /tenants/:id/flag` and `/unflag` |
| A.10 | Add internal notes | ✅ DONE | `POST /tenants/:id/notes` — visible in detail drawer |
| A.11 | Assign account manager | ✅ DONE | `PATCH /tenants/:id/assign-manager` |
| A.12 | Manual restaurant creation (field sales) | ✅ DONE | `POST /super-admin/tenants` — creates tenant + restaurant + owner in one transaction, temp password, welcome email, audit logged. Full dialog in TenantsPage. |

---

## Section B — User Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| B.1 | View all users across all restaurants | ✅ DONE | `GET /super-admin/platform-users` — paginated, cross-tenant |
| B.2 | Search by email / name | ✅ DONE | `ListPlatformUsersQueryDto` supports name + email |
| B.3 | Reset password | ✅ DONE | Returns temp password, audit logged |
| B.4 | Unlock / reactivate account | ✅ DONE | `PATCH /platform-users/:id/unlock` |
| B.5 | Manage super admin team members + roles | ✅ DONE | `GET/POST /super-admin/users` + deactivate |
| B.6 | Search by phone number | ✅ DONE | `phone` param in `ListPlatformUsersQueryDto`; dedicated phone search input in PlatformUsersPage (mutually exclusive with name/email). |
| B.7 | Per-user login history | ✅ DONE | `UserLoginHistory` model. Auth service logs successful + failed attempts (non-blocking). `GET /super-admin/platform-users/:id/login-history`. Login History tab in user drawer. |

---

## Section C — Financial Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| C.1 | Revenue breakdown (subscriptions, GMV, plan distribution) | ✅ DONE | `GET /super-admin/finance/overview` — MRR, ARR, GMV |
| C.2 | Revenue by plan tier / by month | ✅ DONE | `/finance/plan-breakdown` + `/finance/gmv-trend` (12 months) |
| C.3 | Outstanding accounts (trial-expired, suspended, unpaid) | ✅ DONE | `/finance/outstanding` |
| C.4 | Aggregator commission tracking | ✅ DONE | M17 `getCommissionReport()` per restaurant |
| C.5 | SA-wide refund list | ✅ DONE | `GET /super-admin/finance/refunds` — cross-tenant, filter by status / date / tenantId / page. Joins Payment→Restaurant+Tenant. Refunds tab in FinancePage. |
| C.6 | Tax reporting by country | ✅ DONE | `GET /super-admin/finance/tax-report?year=` — raw SQL summing `taxAmount` + GMV by `restaurant.country`. Tax Report tab with year selector, effective rate %, grand total row. |
| C.7 | Payout management | BACKLOG | Only relevant if RestroCloud handles restaurant payouts directly. |
| C.8 | Revenue recognition / deferred revenue | BACKLOG | Accounting-level feature, out of scope for MVP. |

---

## Section D — Subscription & Billing Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| D.1 | View all subscriptions, filter by plan / status / cycle | ✅ DONE | `GET /super-admin/billing/subscriptions` + BillingPage.tsx Subscriptions tab |
| D.2 | Coupon / promo code management | ✅ DONE | Full CRUD + apply to tenant + BillingPage.tsx Coupons tab |
| D.3 | Partner and referral code management | ✅ DONE | Marketing module — referral codes CRUD + apply |
| D.4 | Trial management + conversion tracking | ✅ DONE | Extend trial + `getTrialConversions()` + BillingPage Conversions tab |
| D.5 | Manual invoice creation + SA invoice list | ✅ DONE | `GET/POST /super-admin/billing/invoices` + mark-paid + void. Invoices tab in BillingPage with dynamic line items, status/date filters, mark-paid (✓) and void (✗) actions. |
| D.6 | **Bulk plan change** | ⏳ PENDING | `POST /super-admin/billing/bulk-plan-change` — `{ fromPlan, toPlan, reason }` — updates all matching tenants in a transaction, one audit entry per tenant. |

---

## Section E — Content & Configuration Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| E.1 | Feature flags (global + per restaurant) | ✅ DONE | Full CRUD + per-tenant overrides + FeatureFlagsPage.tsx |
| E.2 | Plan → feature entitlement enforcement | ✅ DONE | `PlanGuard` + `@RequireFeature()` decorator. Redis cache 5 min (`plan:features:{tenantId}`). Enforced on 6 controllers: `delivery`, `inventory`, `crm`, `analytics`, `aggregators`, `multiLocation`. SA bypass. 🔒 badge on enforced features in PlansPage. |
| E.3 | **Available integrations management** | ⏳ PENDING | SA table of supported aggregators / payment gateways with activate/deactivate toggle. Informs what appears in restaurant settings. |
| E.4 | **Currency / exchange rate management** | ⏳ PENDING | `SupportedCurrency` model. SA CRUD. Optional cron to fetch live rates. |
| E.5 | **Tax rate config by country** | ⏳ PENDING | `TaxConfig` model (country, rate, effectiveFrom). SA CRUD. Applied on new restaurant creation. |
| E.6 | **Default settings for new restaurants** | ⏳ PENDING | Key-value config in Redis or DB. SA edit page. Applied during `POST /auth/register`. |
| E.7 | Email template management | BACKLOG | Replace hardcoded HTML in `EmailService` with DB templates. SA markdown editor. |
| E.8 | Language / translation management | BACKLOG | Large scope. Requires i18n framework across all three frontends. |

---

## Section F — Integration & API Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F.1 | **Integration health monitor** | ⏳ PENDING | Log last webhook received / last sync / error count per aggregator connection. `GET /super-admin/integrations/health` — summary across all tenants. |
| F.2 | **API call volume / latency per integration** | ⏳ PENDING | Redis counters in each adapter. Dashboard widget: calls / errors / latency per platform. |
| F.3 | **Webhook config management** | ⏳ PENDING | SA view of all `AggregatorConnection` records cross-tenant. Search by platform. View / rotate webhook secrets. |
| F.4 | Developer API usage tracking | BACKLOG | Requires `ApiKey` model and key issuance system. Not in scope yet. |
| F.5 | **Runtime rate limit management** | ⏳ PENDING | Move throttler config from hardcoded code to DB-backed settings editable by SA. |

---

## Section G — Support & Communication

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| G.1 | Support ticket system (create / assign / prioritize / resolve) | ✅ DONE | Full CRUD + threaded messages + stats. SupportPage.tsx Tickets tab. |
| G.2 | System-wide announcements | ✅ DONE | `GET/POST/DELETE /super-admin/announcements`. SupportPage.tsx Announcements tab. |
| G.3 | Email campaigns / broadcasts to restaurants | ✅ DONE | Segments: ALL / ACTIVE / TRIAL / PAID / SUSPENDED. SupportPage.tsx Broadcasts tab. |
| G.4 | In-app messaging to specific restaurants | ✅ DONE | InAppBanner model — targeted by plan, with impressions tracking. MarketingPage.tsx. |
| G.5 | Knowledge base management | ✅ DONE | `KbArticle` model (slug @unique, body @db.Text, category, isPublished). SA CRUD at `GET/POST /super-admin/kb` + `PATCH/DELETE /super-admin/kb/:slug`. Public `GET /kb` + `GET /kb/:slug` (no auth, separate KbModule). KnowledgeBasePage.tsx with article list, inline publish toggle, full editor, markdown preview, auto-slug. |
| G.6 | Scheduled maintenance notifications | ✅ DONE | `scheduledFor DateTime?` on `Announcement`. `listLiveAnnouncements()` filters by `scheduledFor IS NULL OR <= now` (read-time, no cron). SA sees all with future-scheduled amber ⏰ badge. Datetime picker in create form. |
| G.7 | Live chat management | BACKLOG | Requires third-party integration (Intercom / Crisp). Out of scope. |

---

## Section H — Analytics & Intelligence

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| H.1 | Platform-wide analytics (orders, GMV, AOV, peak times) | ✅ DONE | KPIs + revenue endpoints + IntelligencePage.tsx |
| H.2 | Cohort retention analysis | ✅ DONE | `getCohortRetention()` — sign-up month vs active months heatmap |
| H.3 | Feature adoption tracking | ✅ DONE | `getFeatureAdoption()` — % of active tenants using each module |
| H.4 | At-risk tenant detection | ⚠️ PARTIAL | `getAtRiskTenants()` built with rules-based signals. No AI/ML model. |
| H.5 | **Geographic heat map** | ⏳ PENDING | Add `latitude Float?` + `longitude Float?` to `Restaurant`. Geocode from city/country on creation. SA frontend: Mapbox/Leaflet map with restaurant pins colored by volume / plan. |
| H.6 | **Market analysis by country** | ⏳ PENDING | `GET /super-admin/analytics/by-country` — tenants, GMV, AOV grouped by `Restaurant.country`. Table + bar chart in IntelligencePage. |
| H.7 | **Revenue forecasting** | ⏳ PENDING | Linear regression on last 6 months GMV → project next 3 months. Dashed line continuation on gmv-trend chart. |
| H.8 | NPS / CSAT tracking | BACKLOG | Requires in-app survey trigger and `NpsResponse` model. |

---

## Section I — System Administration

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| I.1 | Server health monitoring (DB / Redis latency, table sizes) | ✅ DONE | `/health` + `/system/health-detail`. SystemPage.tsx. |
| I.2 | Error logging (500 errors) | ✅ DONE | Redis error log, last 200. SystemPage.tsx Error Log tab. |
| I.3 | Security audit logs | ✅ DONE | `audit:global:log` — last 500 SA actions with actor, timestamp, metadata. AuditLogPage.tsx. |
| I.4 | GDPR data deletion | ✅ DONE | `POST /super-admin/system/gdpr/delete-user` — anonymises all customer PII. SystemPage.tsx. |
| I.5 | **Slow query tracking** | ⏳ PENDING | Prisma query event middleware — log queries >500ms to Redis list. `GET /super-admin/system/slow-queries`. Display in SystemPage. |
| I.6 | **Database backup status** | ⏳ PENDING | `GET /super-admin/system/backup-status` — read last pg_dump timestamp from a status file. Display in SystemPage. |
| I.7 | Deployment management | BACKLOG | Infrastructure-level (CI/CD). Out of scope for application layer. |

---

## Section J — Marketing & Growth

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| J.1 | Email campaign management (segmented broadcasts) | ✅ DONE | Broadcasts with ALL / ACTIVE / TRIAL / PAID / SUSPENDED. SupportPage.tsx. |
| J.2 | In-app promotion banners | ✅ DONE | InAppBanner CRUD + toggle + plan targeting + impressions. MarketingPage.tsx. |
| J.3 | Referral program management | ✅ DONE | Referral codes CRUD + apply to tenant + toggle. MarketingPage.tsx. |
| J.4 | **Partner / reseller management** | ⏳ PENDING | New `Partner` model (name, email, commissionPct, referralCode). SA CRUD. Link tenants to partners. Revenue attribution in FinancePage. |
| J.5 | **Affiliate tracking** | ⏳ PENDING | Extend `ReferralCode` with `type: AFFILIATE | REFERRAL`. Track and attribute conversions per affiliate. |
| J.6 | A/B test management | BACKLOG | Requires experiment framework. Out of scope for current stage. |

---

## Section K — Marketplace Management

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| K.1 | Plugin review and approval workflow | BACKLOG | Entire new product surface. Requires plugin SDK + submission portal. |
| K.2 | Marketplace listings management | BACKLOG | Depends on K.1. |
| K.3 | Marketplace revenue and commissions | BACKLOG | Depends on K.1. |
| K.4 | Developer account management | BACKLOG | Requires separate developer portal. |

---

## Role Hierarchy

| Role | Status | Notes |
|------|--------|-------|
| PLATFORM_OWNER | ✅ DONE | In `UserRole` enum. Full access including role management and billing config. |
| SUPER_ADMIN | ✅ DONE | In `UserRole` enum. Full access except billing configuration. |
| SUPPORT_MANAGER | ✅ DONE | In `UserRole` enum. Scoped to tickets, announcements, user support. |
| SUPPORT_AGENT | ✅ DONE | In `UserRole` enum. Read-only restaurant view + assigned tickets. |
| FINANCE_ADMIN | ✅ DONE | In `UserRole` enum. Scoped to billing, invoices, revenue reports. |
| ENGINEERING_ADMIN | ✅ DONE | In `UserRole` enum. Scoped to system admin, feature flags, health. |
| **MARKETING_ADMIN** | ⏳ PENDING | Not in `UserRole` enum. Add enum value, scope to broadcasts / banners / referrals / coupons. Update `@Roles()` decorators on all marketing endpoints. Add to SA Users page role picker. |
| **COUNTRY_MANAGER** | ⏳ PENDING | Not in `UserRole` enum. Add enum value + `countryScope String?` on `User`. Add country filter in `TenantGuard` when role is COUNTRY_MANAGER. SA assigns country on user creation. |

---

## What's Left to Build

### High Impact — build next

| # | Item | Ref | Why now |
|---|------|-----|---------|
| 1 | MARKETING_ADMIN + COUNTRY_MANAGER roles | Roles | Unblocks role-scoped access across marketing + regional features |
| 2 | Bulk plan change | D.6 | One-click migration for price changes affecting many tenants |
| 3 | Market analysis by country | H.6 | Quick win — raw SQL, no new schema, adds IntelligencePage tab |
| 4 | Revenue forecasting | H.7 | High visual value — linear regression on existing GMV trend data |
| 5 | Partner / reseller management | J.4 | Enables channel sales tracking |

### Medium Impact

| # | Item | Ref |
|---|------|-----|
| 6 | Integration health monitor | F.1 |
| 7 | Webhook config management | F.3 |
| 8 | Slow query tracking | I.5 |
| 9 | DB backup status display | I.6 |
| 10 | Affiliate tracking | J.5 |
| 11 | Available integrations management | E.3 |

### Low Impact / Config-heavy

| # | Item | Ref |
|---|------|-----|
| 12 | Tax rate config by country | E.5 |
| 13 | Currency / exchange rate management | E.4 |
| 14 | Default settings for new restaurants | E.6 |
| 15 | Geographic heat map | H.5 |
| 16 | API call volume / latency monitor | F.2 |
| 17 | Runtime rate limit management | F.5 |

### Backlog (not blocking)

- Email template management (E.7)
- Language / translation management (E.8)
- A/B test management (J.6)
- Marketplace module (K.1–K.4)
- Developer API usage tracking (F.4)
- Live chat management (G.7)
- NPS / CSAT tracking (H.8)
- Payout management (C.7)
- Deployment management (I.7)
- Revenue recognition / deferred revenue (C.8)

---

## Coverage Scorecard

| Section | Done | Partial | Pending | Backlog | Total | % Done |
|---------|------|---------|---------|---------|-------|--------|
| 4.1 Dashboard | 10 | 0 | 0 | 0 | 10 | **100%** |
| A. Restaurant Mgmt | 12 | 0 | 0 | 0 | 12 | **100%** |
| B. User Management | 7 | 0 | 0 | 0 | 7 | **100%** |
| C. Financial Mgmt | 6 | 0 | 0 | 2 | 8 | **75%** |
| D. Subscriptions | 5 | 0 | 1 | 0 | 6 | **83%** |
| E. Content & Config | 2 | 0 | 4 | 2 | 8 | **25%** |
| F. Integration/API | 0 | 0 | 4 | 1 | 5 | **0%** |
| G. Support & Comms | 6 | 0 | 0 | 1 | 7 | **86%** |
| H. Analytics & Intel | 3 | 1 | 3 | 1 | 8 | **44%** |
| I. System Admin | 4 | 0 | 2 | 1 | 7 | **57%** |
| J. Marketing & Growth | 3 | 0 | 2 | 1 | 6 | **50%** |
| K. Marketplace | 0 | 0 | 0 | 4 | 4 | **0%** |
| Roles | 6 | 0 | 2 | 0 | 8 | **75%** |
| **TOTAL** | **64** | **1** | **18** | **13** | **96** | **~67%** |

### Sections at 100%
- 4.1 Dashboard ✅
- A. Restaurant Management ✅
- B. User Management ✅

### Sections complete except backlog items
- C. Financial Management (6/6 actionable — C.7/C.8 are intentional backlog)
- G. Support & Communications (6/6 actionable — G.7 requires third-party)
