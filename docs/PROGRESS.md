# RestroCloud — Build Progress Tracker

> Living document. Updated after every sub-component is completed.
> Last updated: 2026-02-28 (M21 CRM & Customer Loyalty complete)

---

## TIER 0: FOUNDATION (Weeks 1–4)

### M0 — Platform Foundation

#### M0.1 — Database Architecture
| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M0.1.1 | PostgreSQL multi-tenant schema (row-level isolation via `tenantId`) | ✅ DONE | Tenant model, all entities have tenantId |
| M0.1.2 | Core entities: Restaurant, User, Role, Permission, UserSession | ✅ DONE | RBAC via UserRole enum + RolePermission join table |
| M0.1.3 | Menu entities: Category, Item, Modifier, ModifierGroup, Combo | ✅ DONE | Full nested modifier support via ItemModifierGroup |
| M0.1.4 | Order entities: Order, OrderItem, OrderModifier, OrderStatus | ✅ DONE | OrderStatusHistory, KitchenStatus enum |
| M0.1.5 | Payment entities: Payment, Refund, Transaction | ✅ DONE | PaymentMethod, PaymentStatus, RefundStatus enums |
| M0.1.6 | Table entities: Table (RestaurantTable), FloorSection, TableSession | ✅ DONE | QR code field, TableStatus, SessionStatus enums |
| M0.1.7 | Customer entities: Customer, Address, LoyaltyAccount | ✅ DONE | LoyaltyTransaction for points history |
| M0.1.8 | Redis setup for caching, sessions, real-time pub/sub | ✅ DONE | RedisModule + RedisService with get/set/json/pub/sub |
| M0.1.9 | Database seeding script with sample restaurant data | ✅ DONE | `npm run db:seed` — Spice Garden demo with menu + tables + staff |

#### M0.2 — Backend Framework (NestJS)
| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M0.2.1 | NestJS + TypeScript scaffold | ✅ DONE | `src/main.ts`, `app.module.ts`, tsconfig |
| M0.2.2 | Module structure (controller + service + DTO per domain) | ✅ DONE | auth, restaurants, menu, orders, tables, payments, customers |
| M0.2.3 | OpenAPI/Swagger at `/api/docs` | ✅ DONE | Full Swagger setup with Bearer auth |
| M0.2.4 | Global error handler (consistent JSON response) | ✅ DONE | `HttpExceptionFilter` — standardised error shape |
| M0.2.5 | DTO validation (class-validator) | ✅ DONE | `ValidationPipe` globally with field-level errors |
| M0.2.6 | Structured JSON logging middleware | ✅ DONE | `LoggingInterceptor` — requestId, method, url, duration |
| M0.2.7 | Rate limiting middleware (429) | ✅ DONE | `@nestjs/throttler` — short/medium/long windows |

#### M0.3 — Authentication System
| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M0.3.1 | JWT token generation (15min access + 7d refresh) | ✅ DONE | `AuthService.generateTokenPair()` |
| M0.3.2 | Token refresh endpoint | ✅ DONE | `POST /api/auth/refresh` with token rotation |
| M0.3.3 | RBAC middleware | ✅ DONE | `RolesGuard` with role hierarchy |
| M0.3.4 | Tenant isolation middleware | ✅ DONE | `TenantGuard` — scopes every request to tenantId |
| M0.3.5 | bcrypt password hashing | ✅ DONE | 12 rounds, `hashPassword()` + `verifyPassword()` |

#### M0.4 — Infrastructure & CI/CD
| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M0.4.1 | Docker containerization | ✅ DONE | `docker-compose.yml` — postgres + redis + optional backend |
| M0.4.2 | CI pipeline (GitHub Actions): lint → test → build | ✅ DONE | `.github/workflows/ci.yml` |
| M0.4.3 | Staging environment deployment | ⏳ PENDING | Configure Railway/Render when ready |
| M0.4.4 | Environment config management (.env) | ✅ DONE | `.env.example` with all vars documented |
| M0.4.5 | Database migration tooling | ✅ DONE | Prisma migrate — `npm run db:migrate:dev` |

#### M0.5 — Real-Time Communication
| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M0.5.1 | WebSocket server (Socket.io) | ✅ DONE | `RealtimeGateway` on `/realtime` namespace |
| M0.5.2 | Room-based broadcasting per restaurant | ✅ DONE | `tenant:{id}` + `restaurant:{id}` + `kitchen:{id}` rooms |
| M0.5.3 | Event types: new_order, order_status_change, item_out_of_stock | ✅ DONE | `RealtimeService` with typed payloads |

---

## M0 VERIFICATION CHECKLIST (Verified 2026-02-26 — ALL PASS ✅)

> Local setup: PostgreSQL 14 (Homebrew) + Redis 8 (Homebrew). Docker not available.
> Fix applied: RealtimeModule imports JwtModule to resolve RealtimeGateway DI.
> Fix applied: backend.env copied to .env.local (ConfigModule) and .env (Prisma).

- [x] `npm run db:migrate:dev` — 1 migration applied, 28 tables created
- [x] `npm run db:seed` — Spice Garden demo data seeded, all credentials work
- [x] `npm run start:dev` — backend starts on port 3000
- [x] `GET /api/health` — `{database: ok, redis: ok}`
- [x] `GET /api/docs` — Swagger UI HTTP 200
- [x] `POST /api/auth/register` — returns accessToken + refreshToken (creates new tenant)
- [x] `POST /api/auth/login` — valid credentials (identifier field) return tokens
- [x] `POST /api/auth/login` — invalid credentials return 401
- [x] `GET /api/restaurants` — with token returns restaurant array (HTTP 200)
- [x] `GET /api/restaurants` — without token returns 401
- [x] `POST /api/auth/refresh` — rotates refresh token, returns new accessToken
- [x] Tenant isolation — Tenant B gets 404 accessing Tenant A's restaurant ID
- [x] Rate limit — requests 21-25 return 429 (limit: 20/1s)
- [x] Socket.io — client connects to ws://localhost:3000/realtime, socket.id assigned
- [x] Databases — PostgreSQL 14 + Redis 8 both healthy via Homebrew services

---

## TIER 1 — MVP CORE

### M1 — Authentication & User Management ✅ BACKEND COMPLETE (2026-02-26)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M1.1 | Owner registration with email verification trigger | ✅ DONE | `POST /api/auth/register` — creates tenant+restaurant, sends verify email |
| M1.2 | Email verification flow | ✅ DONE | `POST /api/auth/verify-email` + resend; dev mode logs to console |
| M1.3 | Login (email + password) | ✅ DONE | Returns tokens or `{requiresTwoFactor, pendingToken}` for 2FA users |
| M1.4 | Phone OTP login | ✅ DONE | `send-otp` + `verify-otp`; Redis TTL 10 min, max 3 attempts |
| M1.5 | Staff user creation by owner/manager | ✅ DONE | `POST /api/users/staff` — OWNER/MANAGER only, welcome email sent |
| M1.6 | Role management + permissions | ✅ DONE | `GET/POST/DELETE /api/users/staff/:id/permissions`; 19 permissions seeded |
| M1.7 | Staff PIN login for POS | ✅ DONE | `POST /api/auth/pin-login` (4–6 digits) + `set-pin` endpoint |
| M1.8 | Session management (list + force logout) | ✅ DONE | `GET /api/auth/sessions` + `DELETE sessions/:id` + revoke-all |
| M1.9 | Password reset flow | ✅ DONE | `forgot-password` + `reset-password`; 1h token, invalidates all sessions |
| M1.10 | TOTP 2FA for owner/manager | ✅ DONE | enable → QR → confirm → login step-2 verify → disable |

**Schema additions:** `twoFaPending`, `emailVerifyToken/Expires`, `passwordResetToken/Expires` on `users`
**New modules:** `EmailModule` (global, console in dev), `UsersModule` (staff CRUD + permissions)
**New packages:** `nodemailer`, `otplib`, `qrcode`

### M2 — Restaurant Profile & Configuration ✅ BACKEND COMPLETE (2026-02-26)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M2.1 | Restaurant profile CRUD (create, read, update, deactivate) | ✅ DONE | OWNER creates/deactivates; MANAGER updates; last branch protected |
| M2.2 | Operating hours + holiday overrides | ✅ DONE | `PATCH /hours` merges into `{regularHours,holidayOverrides}` JSON; `GET /hours/status` is timezone-aware |
| M2.3 | VAT/GST tax rate (inclusive/exclusive) | ✅ DONE | `PATCH /tax`; `calculateTax()` helper on service |
| M2.4 | Multi-currency support | ✅ DONE | `currency` field on restaurant; auto-derived from country on create |
| M2.5 | Service charge percentage | ✅ DONE | `PATCH /service-charge`; 0–100% decimal |
| M2.6 | Tip options (suggested percentages) | ✅ DONE | `PATCH /tip-options`; up to 5 percentages + allowCustom |
| M2.7 | Receipt configuration | ✅ DONE | `PATCH /receipt`; header, footer, showLogo, showTaxBreakdown, showWifi, wifiPassword |
| M2.8 | Order channels (dine-in, takeaway, delivery, etc.) | ✅ DONE | `PATCH /order-types`; enforces min 1 channel; OWNER only |
| M2.9 | Auto-accept per order channel | ✅ DONE | `PATCH /auto-accept`; pos/qr/online/aggregator booleans; MANAGER+ |
| M2.10 | Timezone + locale configuration | ✅ DONE | Part of `PATCH /restaurants/:id`; auto-derived on create |

**Fix applied:** `UpdateHoursDto` uses explicit `RegularHoursDto` class (mon/tue/.../sun) instead of `Record<string,DayHoursDto>` to work with `whitelist:true` ValidationPipe.
**Fix applied:** Seed `operatingHours` uses nested `{regularHours:{...}}` format matching service expectations.

### M3 — Menu Management ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M3.1 | Category CRUD + reorder | ✅ DONE | `GET/POST/PATCH/DELETE /categories`, `PATCH /categories/reorder` |
| M3.2 | Item CRUD + reorder + search/filter | ✅ DONE | `GET/POST/PATCH/DELETE /items`, query params: categoryId, isAvailable, search |
| M3.3 | Modifier group CRUD + reorder | ✅ DONE | `GET/POST/PATCH/DELETE /modifier-groups`, supports inline modifier creation |
| M3.4 | Modifier CRUD + reorder within group | ✅ DONE | `POST/PATCH/DELETE /modifier-groups/:id/modifiers`, `PATCH .../reorder` |
| M3.5 | Item ↔ ModifierGroup attachment | ✅ DONE | `POST/DELETE /items/:id/modifier-groups` (upsert, idempotent) |
| M3.6 | Combos CRUD + availability toggle | ✅ DONE | `GET/POST/PATCH/DELETE /combos`, `PATCH /combos/:id/availability` |
| M3.7 | Item availability toggle | ✅ DONE | `PATCH /items/:id/availability` |
| M3.8 | Full menu tree (cached 60s) | ✅ DONE | `GET /restaurants/:id/menu` — nested categories→items→modifiers, Redis cache |
| M3.9 | Bulk item availability | ✅ DONE | `PATCH /items/bulk-availability` — updates N items in one call |
| M3.10 | RBAC enforcement on all writes | ✅ DONE | MANAGER+ required for all create/update/delete; 403 on STAFF attempt |

**New services:** `ModifierGroupsService`, `CombosService`
**New controllers:** `CategoriesController`, `ItemsController`, `ModifierGroupsController`, `CombosController`
**Cache:** `clearMenuCache(restaurantId)` called on all write operations across all 3 services
**Fix applied:** `MANAGER_ROLES: UserRole[]` explicit type annotation required to make `.includes(role)` type-check

### M3 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /categories` → 201 with new category
- [x] `PATCH /categories/:id` → updates name
- [x] `PATCH /categories/reorder` → 200 `{message: 'Categories reordered'}`
- [x] `POST /items` → 201 with allergens[], dietaryTags[] arrays
- [x] `PATCH /items/:id` → updates name + price
- [x] `PATCH /items/bulk-availability` → `{updated: 2}` for 2 item IDs
- [x] `PATCH /items/reorder` → 200 `{message: 'Items reordered'}`
- [x] `GET /items?isAvailable=true` → filtered list
- [x] `GET /items?search=Burger` → search result
- [x] `POST /modifier-groups` (with inline `modifiers[]`) → 201, 3 modifiers created
- [x] `POST /modifier-groups/:id/modifiers` → 201 new modifier
- [x] `PATCH /modifier-groups/:id` → updates name + maxSelect
- [x] `PATCH /modifier-groups/:id/modifiers/:id` → updates name + isDefault
- [x] `PATCH /modifier-groups/:id/modifiers/reorder` → 200 `{message: 'Modifiers reordered'}`
- [x] `DELETE /modifier-groups/:id/modifiers/:id` → 204 No Content
- [x] `POST /items/:id/modifier-groups` → item now has 1 modifier group
- [x] `DELETE /items/:id/modifier-groups/:mgId` → `{message: 'Modifier group detached'}`
- [x] `POST /combos` (2 items) → 201 Combo with 2 combo items
- [x] `GET /combos` → list (2 combos)
- [x] `PATCH /combos/:id/availability` → `{isAvailable: false}`
- [x] `DELETE /items/:id` → 204 No Content
- [x] `GET /restaurants/:id/menu` → 8 categories, 12 items in active cats
- [x] RBAC: STAFF gets 403 on category create (`Insufficient permissions. Required: MANAGER`)

### M4 — Order Engine (Core) ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M4.1 | Create order with pricing engine | ✅ DONE | Snapshots item/modifier prices, calculates tax+service charge, auto-accept |
| M4.2 | List orders with filters + pagination | ✅ DONE | status, channel, dateFrom, dateTo, page, limit |
| M4.3 | Get order detail | ✅ DONE | Full nested: items → modifiers, statusHistory, table, createdBy |
| M4.4 | Update order status (state machine) | ✅ DONE | PENDING→ACCEPTED→PREPARING→READY→SERVED→COMPLETED; invalid transitions → 400 |
| M4.5 | Cancel order | ✅ DONE | Not allowed on COMPLETED/CANCELLED/REFUNDED; emits realtime event |
| M4.6 | Update item kitchen status (KDS) | ✅ DONE | KITCHEN+ role; `PATCH /orders/:id/items/:itemId/kitchen-status`; emits kitchen_update |
| M4.7 | Void order item | ✅ DONE | Marks isVoid + CANCELLED; recalculates order subtotal/tax/total |
| M4.8 | Add items to existing order | ✅ DONE | Allowed on PENDING/ACCEPTED/PREPARING; recalculates totals |
| M4.9 | Real-time WebSocket events | ✅ DONE | new_order, order_status_change, kitchen_update via RealtimeService |
| M4.10 | Order number generation + RBAC | ✅ DONE | Redis INCR → ORD-00001; CASHIER+ for create; MANAGER+ for status/cancel/void |

**New files**: 8 DTOs, `orders.service.ts` (full rewrite), `orders.controller.ts` (full rewrite), `orders.module.ts` (added RedisModule)
**Pricing engine**: subtotal = items × (price + modifier adjustments); tax = subtotal × taxRate (if not taxInclusive); serviceCharge = subtotal × serviceChargeRate; total = subtotal + tax + service + tip - discount
**Auto-accept**: Maps OrderType → autoAccept JSON key (DINE_IN/TAKEAWAY/DELIVERY/KIOSK → 'pos'; QR → 'qr'; ONLINE → 'online'; AGGREGATOR → 'aggregator')
**Fix**: Same TypeScript literal tuple issue as M3 — `OrderStatus[]` explicit type annotation required for `.includes()`

### M4 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /orders` (DINE_IN, no modifier) → ORD-00001, auto-accepted, subtotal 550, total 673.75 (7.5% tax + 15% service)
- [x] `POST /orders` (TAKEAWAY + modifier + tip) → ORD-00002, unitPrice = base + modifier adjustment
- [x] `GET /orders?page=1&limit=10` → pagination `{total, page, limit, totalPages}`
- [x] `GET /orders?status=ACCEPTED` → filtered list
- [x] `GET /orders/:orderId` → full detail with items, modifiers, statusHistory, table
- [x] `PATCH /orders/:id/status` ACCEPTED→PREPARING → 200 + 2 history entries
- [x] `PATCH /orders/:id/status` PREPARING→PENDING (invalid) → 400 `Cannot transition from PREPARING to PENDING`
- [x] `PATCH /orders/:id/status` PREPARING→READY → readyAt timestamp set
- [x] `PATCH /orders/:id/status` READY→SERVED→COMPLETED → completedAt set, 5 history entries
- [x] `PATCH /orders/:id/items/:itemId/kitchen-status` → kitchenStatus: PREPARING
- [x] `PATCH /orders/:id/items/:itemId/void` → isVoid: true, kitchenStatus: CANCELLED, totals recalculated
- [x] `POST /orders/:id/items` (add items) → 2 items, subtotal 550, total 693.75 (with tip)
- [x] `PATCH /orders/:id/cancel` → CANCELLED, cancelReason, cancelledAt set
- [x] Cancel again (already CANCELLED) → 400 `Cannot cancel an order with status: CANCELLED`
- [x] RBAC: STAFF → 403 `Insufficient permissions. Required: CASHIER`
- [x] Date range filter `?dateFrom=...&dateTo=...` → correct count
- [x] Channel/status filter `?status=CANCELLED` → 1 order

### M9 — Admin Analytics Dashboard ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M9.1 | Dashboard KPIs | ✅ DONE | `GET /analytics/dashboard` — today: revenue, orders, avgOrderValue, newCustomers, activeSessions, pendingOrders; vs yesterday % change; 60s Redis cache |
| M9.2 | Revenue by day | ✅ DONE | `GET /analytics/revenue` — daily breakdown, totalRevenue, totalOrders, avgDailyRevenue; 5min cache |
| M9.3 | Orders by channel | ✅ DONE | `GET /analytics/orders/by-channel` — count + revenue per channel (DINE_IN, TAKEAWAY, DELIVERY, etc.) |
| M9.4 | Top selling items | ✅ DONE | `GET /analytics/menu/top-items` — rank, name, totalQty, totalRevenue; configurable limit |
| M9.5 | Orders by status | ✅ DONE | `GET /analytics/orders/by-status` — count + percentage per status |
| M9.6 | Payments by method | ✅ DONE | `GET /analytics/payments/by-method` — CASH/CARD/MOBILE etc.; revenue + percentage split |
| M9.7 | Customer overview | ✅ DONE | `GET /analytics/customers/overview` — new vs total; top spenders by revenue |
| M9.8 | Staff activity | ✅ DONE | `GET /analytics/staff/activity` — orders, revenue, avgOrderValue per staff member |
| M9.9 | Hourly heatmap | ✅ DONE | `GET /analytics/orders/hourly` — 24-slot array + peakHour; all 24 hours filled (0 for empty) |
| M9.10 | Period comparison | ✅ DONE | `GET /analytics/compare` — current vs same-duration previous period; % change for revenue/orders/avgOrderValue/newCustomers |

**New module**: `src/analytics/` — `analytics.module.ts`, `analytics.service.ts`, `analytics.controller.ts`, `dto/analytics-query.dto.ts`; registered in `app.module.ts`
**Caching**: All endpoints cached in Redis (60s for dashboard, 5min for all others). Key: `analytics:{restaurantId}:{endpoint}:{dateFrom}:{dateTo}:{limit}`
**Raw SQL**: 4 endpoints use `$queryRaw` (revenue-by-day, top-items, customer-topSpenders, staff-activity). Column names are camelCase (no `@map()` in schema). Table names are snake_case via `@@map()`.
**Fix applied**: Schema uses camelCase column names (`"createdAt"`, `"totalAmount"`, `"orderId"`, `"isVoid"`, `"firstName"` etc.) — not snake_case — in raw queries

### M9 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `GET /analytics/dashboard` → revenue:3333.76, orders:7, completedOrders:6, avgOrderValue:555.63, newCustomers:1, activeSessions:0
- [x] `GET /analytics/revenue?dateFrom=2026-02-27&dateTo=2026-02-27` → totalRevenue:3333.76, totalOrders:6, days:1
- [x] `GET /analytics/orders/by-channel` → DINE_IN(4 orders, 2021.26), TAKEAWAY(2, 1312.5), DELIVERY(1, 336.88)
- [x] `GET /analytics/menu/top-items?limit=3` → rank1: "Test Burger", qty:10, revenue:2750
- [x] `GET /analytics/orders/by-status` → ACCEPTED(71.4%), COMPLETED(14.3%), CANCELLED(14.3%)
- [x] `GET /analytics/payments/by-method` → CASH(72.3%), CARD(27.7%)
- [x] `GET /analytics/customers/overview` → newCustomers:1, total:2, topSpenders:[{Rahim Uddin, 1 order}]
- [x] `GET /analytics/staff/activity` → Karim Hossain (OWNER): 6 orders, ৳3333.76, avg:555.63
- [x] `GET /analytics/orders/hourly` → peakHour:06:00, activeHours:2
- [x] `GET /analytics/compare` → currentPeriod revenue:3333.76, previousPeriod revenue:0 (no prior data), changes:null
- [x] Redis cache: same request served in 24ms (cache hit)
- [x] RBAC: MANAGER+ required (all endpoints on controller level)

---

### M8 — Customer Management ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M8.1 | Create customer | ✅ DONE | `POST /customers` — CASHIER+; unique phone+email per restaurant; auto-creates loyalty account |
| M8.2 | List customers | ✅ DONE | `GET /customers` — search (name/phone/email), pagination |
| M8.3 | Get customer detail | ✅ DONE | `GET /customers/:id` — with addresses, loyalty account (last 5 txns), recent orders |
| M8.4 | Update customer | ✅ DONE | `PATCH /customers/:id` — CASHIER+; uniqueness re-checked on phone/email change |
| M8.5 | Blacklist / unblacklist | ✅ DONE | `PATCH /customers/:id/blacklist` — MANAGER+; toggles isBlacklisted |
| M8.6 | Address CRUD | ✅ DONE | `POST/GET/PATCH/DELETE /customers/:id/addresses` — CASHIER+; isDefault clears other defaults |
| M8.7 | Get loyalty account | ✅ DONE | `GET /customers/:id/loyalty` — with last 20 transactions |
| M8.8 | Earn loyalty points | ✅ DONE | `POST /customers/:id/loyalty/earn` — CASHIER+; amount→floor(amount/10) pts OR direct points; tier auto-upgrades |
| M8.9 | Redeem loyalty points | ✅ DONE | `POST /customers/:id/loyalty/redeem` — CASHIER+; 1pt=৳1; validates available balance; records REDEEM transaction |
| M8.10 | Customer order history | ✅ DONE | `GET /customers/:id/orders` — paginated; customerId linked on order create |

**New files**: 6 DTOs (create/update-customer, list-query, create/update-address, earn-points, redeem-points), `customers.service.ts` (full rewrite), `customers.controller.ts` (full rewrite)
**Loyalty tiers**: BRONZE (0–999 earned) → SILVER (1000–4999) → GOLD (5000–9999) → PLATINUM (10000+); promoted automatically on earn
**Points calculation**: `floor(amount / 10)` or direct points value; 1 point = ৳1 discount on redeem

### M8 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /customers` → 201 with loyalty account (BRONZE tier)
- [x] `POST /customers` duplicate phone → 409 "Phone already registered"
- [x] `GET /customers` → pagination, total: 2
- [x] `GET /customers?search=rahim` → filtered result
- [x] `GET /customers/:id` → addresses[], loyaltyAccount.points, orders[]
- [x] `PATCH /customers/:id` → notes updated
- [x] `PATCH /customers/:id/blacklist` → isBlacklisted: true, then false (toggle)
- [x] `POST /customers/:id/addresses` isDefault:true → address created, isDefault: true
- [x] Second address added → Home default first in list, Office second
- [x] `PATCH /customers/:id/addresses/:id` → postalCode updated
- [x] `POST /customers/:id/loyalty/earn` amount:693.75 → 69 pts, BRONZE
- [x] `POST /customers/:id/loyalty/earn` points:5000 → total 5069, tier→GOLD
- [x] `POST /customers/:id/loyalty/redeem` 200pts → discountValue:200, totalRedeemed:200
- [x] Redeem 9999pts (>available 4869) → 400 "Insufficient points"
- [x] `GET /customers/:id/loyalty` → points:4869, tier:GOLD, transactions:[REDEEM,EARN,EARN]
- [x] `GET /customers/:id/orders` before linking → total:0
- [x] Create order with customerId → ORD-00007; `GET /orders` → total:1
- [x] `DELETE /customers/:id/addresses/:id` → 204; remaining addresses: 1

---

### M11 — Notifications ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M11.1 | Schema + migration | ✅ DONE | `Notification` model + `NotificationPreference` model + `NotificationType` enum; migration `20260227_m11_notifications` |
| M11.2 | Core `notify()` service method | ✅ DONE | Resolves recipients by targetUserIds or targetRoles; checks preferences (pushEnabled + mutedTypes); bulk-creates DB records; emits realtime `notification` event |
| M11.3 | List notifications (user-scoped) | ✅ DONE | `GET /restaurants/:id/notifications/me` — filters: type, unreadOnly, page, limit; includes unreadCount |
| M11.4 | Unread count | ✅ DONE | `GET /restaurants/:id/notifications/me/unread-count` — for bell icon badge |
| M11.5 | Mark single read | ✅ DONE | `PATCH /restaurants/:id/notifications/me/:notifId/read` — updates isRead + readAt |
| M11.6 | Mark many read | ✅ DONE | `POST /restaurants/:id/notifications/me/read` — bulk by ids[] array |
| M11.7 | Mark all read | ✅ DONE | `PATCH /restaurants/:id/notifications/me/read-all` — clears all unread for user+restaurant |
| M11.8 | Delete notification | ✅ DONE | `DELETE /restaurants/:id/notifications/me/:notifId` |
| M11.9 | Notification preferences | ✅ DONE | `GET/PUT /restaurants/:id/notifications/me/preferences` — pushEnabled, emailEnabled, mutedTypes[], quietHoursStart/End; upsert pattern |
| M11.10 | Admin list all | ✅ DONE | `GET /restaurants/:id/notifications` — MANAGER+; all notifications for the restaurant |
| M11.11 | Trigger: NEW_ORDER | ✅ DONE | Injected into `OrdersService.createOrder()` — targets KITCHEN + MANAGER + OWNER roles |
| M11.12 | Trigger: ORDER_READY + ORDER_STATUS_CHANGE | ✅ DONE | Injected into `OrdersService.updateOrderStatus()` — READY targets WAITER+CASHIER+MANAGER+OWNER; other changes target MANAGER+OWNER |
| M11.13 | Trigger: PAYMENT_RECEIVED + REFUND_ISSUED | ✅ DONE | Injected into `PaymentsService.processPayment()` + `issueRefund()` — targets MANAGER + OWNER |

**New files**: `src/notifications/` — 3 DTOs, `notifications.service.ts`, `notifications.controller.ts`, `notifications.module.ts`
**Schema additions**: `NotificationType` enum (8 types), `Notification` model, `NotificationPreference` model
**Trigger integration**: `OrdersModule` + `PaymentsModule` both import `NotificationsModule`; all notify() calls are non-blocking (`.catch()` swallowed)
**Preferences**: Defaults returned as virtual object (no DB record) when no prefs set; upsert on first update
**Muted types**: When owner mutes `NEW_ORDER`, NEW_ORDER notifications are filtered out silently before DB write

### M11 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] Initial `GET .../me/unread-count` → `{unreadCount: 0}`
- [x] `POST /orders` creates order → NEW_ORDER notification auto-created → unread count = 1
- [x] `GET .../me` → notification with `{type:"NEW_ORDER", title:"New order #ORD-...", isRead:false}`
- [x] `PATCH .../me/:id/read` → `{isRead:true, readAt:...}`; unread count drops to 0
- [x] Create 2 more orders → 2 unread notifications; `GET .../me?unreadOnly=true` → 2 items
- [x] `POST .../me/read` with ids[] → `{marked: 2}`
- [x] `PATCH .../me/read-all` → `{marked: 0}` (already all read)
- [x] `DELETE .../me/:id` → `{message: "Notification deleted"}`; total drops from 3 to 2
- [x] `GET .../me/preferences` (no record) → defaults: `{pushEnabled:true, emailEnabled:true, mutedTypes:[]}`
- [x] `PUT .../me/preferences` with `{emailEnabled:false, mutedTypes:["NEW_ORDER"], quietHoursStart:"22:00", quietHoursEnd:"08:00"}` → saved correctly
- [x] Create order after muting NEW_ORDER → unread count stays at 0 (muted type respected)
- [x] `GET .../notifications` (admin) OWNER → all 6 restaurant notifications, types: ["NEW_ORDER"]
- [x] `GET .../notifications` (admin) WAITER → 403 "Insufficient permissions. Required: MANAGER"
- [x] Create order + `POST /orders/:id/payments` CARD → PAYMENT_RECEIVED notification with title "Payment received — CARD"
- [x] `GET .../me?type=PAYMENT_RECEIVED` → notification with correct body

---

### M10 — Super Admin Panel ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M10.1 | Platform KPIs | ✅ DONE | `GET /super-admin/platform/kpis` — total/active/suspended tenants, restaurants, users, today's orders + revenue, new tenants this month |
| M10.2 | List tenants | ✅ DONE | `GET /super-admin/tenants` — paginated; filters: search, plan, isActive; includes restaurantCount, userCount |
| M10.3 | Tenant detail | ✅ DONE | `GET /super-admin/tenants/:id` — full tenant with restaurants, users, totalRevenue, totalOrders, lastOrderAt |
| M10.4 | Suspend tenant | ✅ DONE | `PATCH /super-admin/tenants/:id/suspend` — sets tenant.isActive=false + all users isActive=false; busts Redis caches |
| M10.5 | Activate tenant | ✅ DONE | `PATCH /super-admin/tenants/:id/activate` — reverses suspension; re-enables all users |
| M10.6 | Change plan | ✅ DONE | `PATCH /super-admin/tenants/:id/plan` — STARTER/GROWTH/PRO/ENTERPRISE; logs audit event with prev/next plan |
| M10.7 | Impersonate restaurant | ✅ DONE | `POST /super-admin/tenants/:id/impersonate` — issues 1-hour JWT scoped to restaurant owner; works as full auth token |
| M10.8 | Platform revenue | ✅ DONE | `GET /super-admin/platform/revenue` — cross-tenant SQL; group by day/week/month; totalRevenue, totalOrders, activeTenants per period |
| M10.9 | Audit log | ✅ DONE | `GET /super-admin/audit-log` — Redis-backed (last 500 events); paginated; logs all suspend/activate/plan/impersonate/user actions |
| M10.10 | List super admins | ✅ DONE | `GET /super-admin/users` — users with role=SUPER_ADMIN |
| M10.11 | Create super admin | ✅ DONE | `POST /super-admin/users` — creates under `restrocloud-platform` tenant (upserted); bcrypt hashed |
| M10.12 | Deactivate super admin | ✅ DONE | `PATCH /super-admin/users/:id/deactivate` — blocks self-deactivation; busts Redis cache |
| M10.13 | System health | ✅ DONE | `GET /super-admin/health` — DB + Redis latency; overall status (healthy/degraded); platform counts |

**New files**: `src/super-admin/` module — 5 DTOs, `super-admin.service.ts`, `super-admin.controller.ts`, `super-admin.module.ts`; seed updated with platform tenant + super admin user
**Platform tenant**: `restrocloud-platform` tenant (ENTERPRISE plan) houses all SUPER_ADMIN users (required by schema)
**Audit log**: Redis key `audit:global:log` — JSON array, max 500 entries, newest-first; logs: TENANT_SUSPENDED/ACTIVATED, PLAN_CHANGED, IMPERSONATION, SUPER_ADMIN_CREATED/DEACTIVATED
**Suspension**: cascade updates ALL tenant users to isActive=false + flushes `user:*` Redis caches for instant lockout
**Impersonation token**: signed with same JWT secret; NestJS JwtModule merges issuer/audience signOptions automatically; 1-hour TTL; full owner context returned from /auth/me

### M10 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /auth/login` with superadmin@restrocloud.com → returns valid token
- [x] `GET /super-admin/platform/kpis` → tenants{total,active,suspended,newThisMonth}, restaurants, users, orders{today,allTimeRevenue,todayRevenue}
- [x] `GET /super-admin/tenants` → paginated list, restaurantCount/userCount populated
- [x] `GET /super-admin/tenants?search=spice` → filtered to Spice Garden tenant
- [x] `GET /super-admin/tenants?plan=STARTER` → filtered by plan
- [x] `GET /super-admin/tenants/:id` → full detail with stats (totalRevenue, totalOrders, lastOrderAt)
- [x] `PATCH /super-admin/tenants/:id/suspend` → tenant.isActive=false, affectedUsers count
- [x] `PATCH /super-admin/tenants/:id/suspend` again → 400 "already suspended"
- [x] `PATCH /super-admin/tenants/:id/activate` → tenant.isActive=true, reactivatedUsers count
- [x] `PATCH /super-admin/tenants/:id/plan` → plan changed (PRO→ENTERPRISE→PRO)
- [x] `POST /super-admin/tenants/:id/impersonate` → accessToken, impersonating{tenantId,tenantName,restaurantId,restaurantName,userId,userEmail}
- [x] Impersonation token → `GET /auth/me` returns owner's profile (id, role=OWNER, email, restaurantId)
- [x] `GET /super-admin/platform/revenue?dateFrom=2026-01-01&groupBy=day` → summary.totalRevenue, data[]{date,revenue,orders,activeTenants}
- [x] `GET /super-admin/platform/revenue?groupBy=month` → month-grouped data
- [x] `GET /super-admin/audit-log` → 6 events: TENANT_SUSPENDED, TENANT_ACTIVATED, PLAN_CHANGED×2, IMPERSONATION×2
- [x] `GET /super-admin/users` → [superadmin@restrocloud.com]
- [x] `POST /super-admin/users` → new SUPER_ADMIN user created (isActive:true)
- [x] `PATCH /super-admin/users/:id/deactivate` → deactivated message
- [x] `PATCH /super-admin/users/:selfId/deactivate` → 400 "Cannot deactivate your own account"
- [x] `GET /super-admin/health` → {status:healthy, checks:{database:{healthy,latencyMs},redis:{healthy,latencyMs}}, counts}
- [x] RBAC: OWNER calling `GET /super-admin/platform/kpis` → 403 "Insufficient permissions. Required: SUPER_ADMIN"

---

### M6 — KDS (Kitchen Display System) ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M6.1 | KDS Queue view | ✅ DONE | `GET /kds/queue` — active orders for kitchen display; derived overallKitchenStatus; elapsedSeconds; station/channel/status filter |
| M6.2 | Acknowledge order | ✅ DONE | `PATCH /kds/orders/:id/acknowledge` — QUEUED→ACKNOWLEDGED for all items; throws 400 if nothing to acknowledge |
| M6.3 | Start cooking | ✅ DONE | `PATCH /kds/orders/:id/start` — QUEUED/ACKNOWLEDGED→PREPARING; auto-advances order PENDING→ACCEPTED |
| M6.4 | Mark item ready | ✅ DONE | `PATCH /kds/orders/:id/items/:itemId/ready` — individual item READY; auto-bumps order if all items done |
| M6.5 | Bump order ready | ✅ DONE | `PATCH /kds/orders/:id/bump-ready` — all items→READY; order status→READY; readyAt set; notifies waiters/cashiers |
| M6.6 | Mark item served | ✅ DONE | `PATCH /kds/orders/:id/items/:itemId/served` — validates READY before SERVED; individual item |
| M6.7 | Bump order served | ✅ DONE | `PATCH /kds/orders/:id/bump-served` — all READY items→SERVED; removes order from active queue |
| M6.8 | KDS History | ✅ DONE | `GET /kds/history` — recently ready/completed orders; prepSeconds (acceptedAt→readyAt) |
| M6.9 | KDS Stats | ✅ DONE | `GET /kds/stats` — avg prep time, items by status (queued/acknowledged/preparing/ready), today's order count |
| M6.10 | Station filter | ✅ DONE | `GET /kds/queue?categoryId=UUID` — filters orders/items to specific kitchen station; ?channel and ?status also work |

**New files**: 2 DTOs (`kds-queue-query.dto.ts`, `kds-history-query.dto.ts`), `kds.service.ts` (9 methods + 2 private helpers), `kds.controller.ts` (9 endpoints), `kds.module.ts` (PrismaModule + RealtimeModule + NotificationsModule)
**Key design**: Separate `src/kds/` module — dedicated display surface; `deriveOverallKitchenStatus()` computed from item statuses; `autoBumpOrderReady()` private helper shared by bumpOrderReady + markItemReady (when all items done); ORDER_READY notification fires to WAITER/CASHIER/MANAGER/OWNER
**Guards**: All endpoints require KITCHEN+ role minimum; stats require MANAGER+
**Auto-advance**: startOrder() advances order PENDING→ACCEPTED when kitchen begins; bumpOrderReady() sets readyAt + creates statusHistory

### M6 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `GET /kds/queue` returns active orders with orderId, overallKitchenStatus, elapsedSeconds, items[]
- [x] `GET /kds/queue?channel=DINE_IN` filters to DINE_IN orders only
- [x] `GET /kds/queue?status=QUEUED` filters to QUEUED status orders
- [x] `GET /kds/queue?categoryId=<uuid>` station filter accepted and returns filtered results
- [x] `PATCH .../acknowledge` → acknowledged: 1 (QUEUED→ACKNOWLEDGED)
- [x] `PATCH .../start` → started: 1 (QUEUED/ACKNOWLEDGED→PREPARING)
- [x] `PATCH .../items/:id/ready` → kitchenStatus: READY
- [x] `PATCH .../bump-ready` → bumped: 1, orderNumber returned; autoBumpOrderReady fires
- [x] `PATCH .../items/:id/served` → kitchenStatus: SERVED (validates READY first)
- [x] `PATCH .../bump-served` → served: 1, orderNumber returned

---

### M7 — Payments ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M7.1 | Process single payment | ✅ DONE | `POST /orders/:orderId/payments` — CASHIER+; CASH/CARD/MOBILE_BANKING/ONLINE/WALLET/CREDIT; immediate COMPLETED status |
| M7.2 | Split payment | ✅ DONE | Same endpoint called multiple times; tracks outstanding balance; isFullyPaid flag |
| M7.3 | List payments for order | ✅ DONE | `GET /orders/:orderId/payments` — with totalPaid, outstanding, isFullyPaid summary |
| M7.4 | List all restaurant payments | ✅ DONE | `GET /payments` — filters: status, method, dateFrom, dateTo, page, limit |
| M7.5 | Get payment detail | ✅ DONE | `GET /payments/:paymentId` — with refunds[], transactions[], order snapshot |
| M7.6 | Issue refund (partial or full) | ✅ DONE | `POST /payments/:paymentId/refunds` — MANAGER+; validates against remaining balance; PARTIALLY_REFUNDED → REFUNDED |
| M7.7 | Cancel payment | ✅ DONE | `PATCH /payments/:paymentId/cancel` — MANAGER+; only PENDING/PROCESSING |
| M7.8 | List refunds for payment | ✅ DONE | `GET /payments/:paymentId/refunds` |
| M7.9 | Payment summary | ✅ DONE | `GET /payments/summary` — breakdown by method; gross/refunded/net; default=today |
| M7.10 | RBAC + realtime events | ✅ DONE | CASHIER+ for process; MANAGER+ for refund/cancel; payment_processed + refund_issued events |

**New files**: 3 DTOs (process-payment, issue-refund, list-payments-query), `payments.service.ts` (full rewrite), `payments.controller.ts` (2 controllers: PaymentsController + OrderPaymentsController), `payments.module.ts` (RealtimeModule import)
**Summary includes**: COMPLETED + PARTIALLY_REFUNDED + REFUNDED payments to accurately show gross/net/refunded
**Transaction records**: CHARGE created on payment; REFUND created on each refund
**Split payment**: Outstanding = totalAmount − Σ(COMPLETED payments); validated per call

### M7 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /orders/:id/payments` CASH full amount → COMPLETED, isFullyPaid: true, outstanding: 0
- [x] `POST /orders/:id/payments` on fully paid order → 400 "Order is already fully paid"
- [x] `GET /orders/:id/payments` → payments[], summary: {totalPaid, outstanding, isFullyPaid}
- [x] `GET /payments` → paginated list with total
- [x] `GET /payments?method=CASH` → filtered by method
- [x] `GET /payments/:paymentId` → detail with transactions (1 CHARGE), refunds (0)
- [x] `POST /payments/:id/refunds` 100 partial → refund COMPLETED, payment→PARTIALLY_REFUNDED
- [x] `POST /payments/:id/refunds` exceeds balance → 400 "exceeds refundable balance (573.75)"
- [x] `POST /payments/:id/refunds` remaining 573.75 → payment→REFUNDED, transactions: 3
- [x] `PATCH /payments/:id/cancel` on REFUNDED → 400 "Cannot cancel a payment with status: REFUNDED"
- [x] `GET /payments/summary` — totalTransactions: 3, totalGross: 1347.50, totalRefunded: 673.75, totalNet: 673.75; byMethod: CASH(973.75 gross, 673.75 refunded), CARD(373.75 net)
- [x] Split payment: 300 CASH → outstanding: 373.75, isFullyPaid: false; 373.75 CARD → outstanding: 0, isFullyPaid: true
- [x] RBAC: CASHIER+ for process; MANAGER+ for refund/cancel

---

### M5 — POS System ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M5.1 | Floor section CRUD | ✅ DONE | `GET/POST/PATCH/DELETE /floor-sections` — MANAGER+ for writes |
| M5.2 | Tables CRUD | ✅ DONE | `GET/POST/PATCH/DELETE /tables` — MANAGER+ for writes; filter by floorSectionId, status |
| M5.3 | Table status management | ✅ DONE | `PATCH /tables/:id/status` — WAITER+; emits realtime event |
| M5.4 | Open table session | ✅ DONE | `POST /tables/:id/sessions` — WAITER+; 409 if already OPEN/BILL_REQUESTED; sets table→OCCUPIED |
| M5.5 | Get current session | ✅ DONE | `GET /tables/:id/sessions/current` — with nested orders |
| M5.6 | Request bill | ✅ DONE | `PATCH /tables/:id/sessions/current/bill-request` — OPEN→BILL_REQUESTED; emits bill_requested event |
| M5.7 | Close session | ✅ DONE | `PATCH /tables/:id/sessions/:sessionId/close` — WAITER+; fails if incomplete orders; sets CLEANING |
| M5.8 | Apply discount to order | ✅ DONE | `PATCH /orders/:id/discount` — MANAGER+; FLAT or PERCENT; recalculates total |
| M5.9 | Assign order to table/session | ✅ DONE | `PATCH /orders/:id/table` — MANAGER+; links tableId + tableSessionId |
| M5.10 | POS tables overview | ✅ DONE | `GET /tables/overview` — summary stats + all sections with live table status |

**New files**: 7 table DTOs, 2 order DTOs (apply-discount, assign-table), `tables.service.ts` (full rewrite), `tables.controller.ts` (full rewrite), `floor-sections.controller.ts` (new), `tables.module.ts` (updated)
**Session lifecycle**: OPEN → BILL_REQUESTED → CLOSED; table status: AVAILABLE → OCCUPIED (open) → CLEANING (close)
**Route ordering**: Static `overview`, `sessions/current`, `sessions/current/bill-request` registered BEFORE parameterized `:tableId`/`:sessionId` routes
**DiscountType**: FLAT (fixed deduction) or PERCENT (% of subtotal, 0–100), recalculates total on apply

### M5 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /floor-sections` → 201 with new "Rooftop Terrace" section
- [x] `GET /floor-sections` → 3 sections (Indoor 10 tables, VIP 3 tables, Rooftop Terrace 0)
- [x] `PATCH /floor-sections/:id` → name updated
- [x] `POST /tables` → Table R1, capacity 6, status AVAILABLE
- [x] `GET /tables?floorSectionId=...` → filtered list (3 tables in Rooftop Terrace section)
- [x] `GET /tables` (all) → 14 tables total
- [x] `GET /tables/:id` → detail with sessions array
- [x] `GET /tables/overview` → `{summary:{total:14, available:14, ...}, sections:[...]}`
- [x] `PATCH /tables/:id/status` → RESERVED
- [x] `POST /tables/:id/sessions` (4 guests) → session opened, table→OCCUPIED
- [x] `POST /tables/:id/sessions` again → 409 Conflict "Table already has an active session"
- [x] `GET /tables/:id/sessions/current` → active session with nested orders
- [x] `PATCH /tables/:id/sessions/current/bill-request` → status→BILL_REQUESTED
- [x] `PATCH /tables/:id/sessions/:id/close` → CLOSED, table→CLEANING
- [x] `GET /tables/:id` after close → status CLEANING, activeSessionsCount: 0
- [x] `PATCH /orders/:id/discount` PERCENT 10% → discountAmount: 55, total: 638.75
- [x] `PATCH /orders/:id/discount` on COMPLETED order → 400 "Cannot apply discount to a COMPLETED order"
- [x] `PATCH /orders/:id/table` → tableId + tableSessionId assigned

---

---

## TIER 2: CUSTOMER CHANNELS

### M12 — QR Table Ordering ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M12.1 | QR code resolve | ✅ DONE | `GET /qr/:restaurantId/:tableId` — restaurant info, table info, activeSession; 30s Redis cache |
| M12.2 | Public menu view | ✅ DONE | `GET /qr/:restaurantId/menu` — full category+item+modifier tree; costPrice stripped; reuses MenuService 60s cache |
| M12.3 | Menu item detail | ✅ DONE | `GET /qr/:restaurantId/menu/items/:itemId` — single item with all modifier groups; isAvailable validated |
| M12.4 | Init guest cart | ✅ DONE | `POST /qr/:restaurantId/:tableId/cart/init` — generates guestToken UUID; Redis cart TTL 1hr |
| M12.5 | Cart CRUD | ✅ DONE | POST/PATCH/DELETE cart — live price from DB on add; cartItemId for stable updates/removes |
| M12.6 | View cart | ✅ DONE | `GET /qr/:restaurantId/cart?guestToken=...` — subtotal + tax/svc/total estimates |
| M12.7 | Place order | ✅ DONE | `POST /qr/:restaurantId/place-order` — full pricing engine via OrdersService; auto opens/reuses TableSession; fires NEW_ORDER notification + realtime |
| M12.8 | Track order | ✅ DONE | `GET /qr/:restaurantId/orders/:orderId/status?guestToken=...` — status + item kitchenStatuses + statusHistory |
| M12.9 | Request bill | ✅ DONE | `POST /qr/:restaurantId/orders/:orderId/request-bill` — idempotent; session→BILL_REQUESTED; notifies WAITER/CASHIER/MANAGER/OWNER |
| M12.10 | Get receipt | ✅ DONE | `GET /qr/:restaurantId/orders/:orderId/receipt?guestToken=...` — full receipt with items, totals, payments |
| M12.11 | Identify guest | ✅ DONE | `POST /qr/:restaurantId/identify` — optional name/phone; finds/creates Customer; stores customerId in cart |
| M12.12 | Generate QR code | ✅ DONE | `POST /restaurants/:restaurantId/tables/:tableId/qr-code` — MANAGER+; generates PNG data URI via qrcode library |

**New module**: `src/qr-ordering/` — service, 2 controllers (public + staff), 5 DTOs, module
**Schema changes**: `guestName String?` + `guestPhone String?` added to `Order` model (migration `20260227093051_m12_qr_guest_fields`)
**Orders changes**: `createOrder(userId: string | null)` — createdById was already nullable in schema; `tableSessionId` added to `CreateOrderDto`
**Public API**: All `/qr/*` endpoints have zero guards — fully public (no JWT, no tenant header)
**Security**: guestToken→orderId ownership validated via Redis key `qr:order:{restaurantId}:{guestToken}` on track/bill/receipt
**Route ordering**: Static-segment routes (`/menu`, `/cart`, `/identify`, `/place-order`, `/orders/*`) must be declared BEFORE the 2-param `/:restaurantId/:tableId` catch-all in Express to avoid shadowing

### M12 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `GET /qr/:restaurantId/:tableId` → restaurant name, table number, null activeSession
- [x] `GET /qr/:restaurantId/menu` → 8 categories, costPrice not exposed
- [x] `GET /qr/:restaurantId/menu/items/:itemId` → item name, modifierGroups, costPrice hidden
- [x] `POST /qr/:restaurantId/:tableId/cart/init` → guestToken UUID returned
- [x] `POST /qr/:restaurantId/cart` (add item) → cart with items[], subtotal
- [x] `PATCH /qr/:restaurantId/cart/:cartItemId` (update qty) → itemCount updated
- [x] `DELETE /qr/:restaurantId/cart/:cartItemId` → items after delete: 0
- [x] `GET /qr/:restaurantId/cart?guestToken=...` → totalEstimate with tax+svc estimates
- [x] `POST /qr/:restaurantId/identify` → firstName: Ahmed, isNewCustomer: true
- [x] `POST /qr/:restaurantId/place-order` → ORD-00013 PENDING, total 1010.63; TableSession auto-created
- [x] `GET /qr/:restaurantId/orders/:orderId/status?guestToken=...` → status: PENDING, items: 1
- [x] `POST /qr/:restaurantId/orders/:orderId/request-bill` → BILL_REQUESTED, staff notified
- [x] `GET /qr/:restaurantId/orders/:orderId/receipt?guestToken=...` → receipt with totalAmount: 1010.63
- [x] Wrong guestToken → 403 "Order access denied — invalid guest token"
- [x] `POST /restaurants/:restaurantId/tables/:tableId/qr-code` (MANAGER+) → qrDataUri: data:image/png;base64,...

---

### M13 — Online Ordering ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M13.1 | Restaurant lookup by publicSlug | ✅ DONE | `GET /online/:slug` — delivery settings, operating hours, order types |
| M13.2 | Public menu by slug | ✅ DONE | `GET /online/:slug/menu` — full category+item+modifier tree; reuses MenuService |
| M13.3 | Item detail by slug | ✅ DONE | `GET /online/:slug/menu/items/:itemId` — single item with modifier groups |
| M13.4 | Customer auth (register/login/me) | ✅ DONE | `POST /online/:slug/auth/register+login` — bcrypt, customer JWT (24h), separate CustomerJwtStrategy |
| M13.5 | Online cart management | ✅ DONE | Redis cart: init/add/update/delete/view; cartToken; 2h TTL; namespace `online:cart:` |
| M13.6 | Delivery address support | ✅ DONE | `PlaceOnlineOrderDto.deliveryAddress` — required for DELIVERY; stored as `deliveryAddress Json?` on Order |
| M13.7 | Place online order | ✅ DONE | `POST /online/:slug/orders` — DELIVERY or TAKEAWAY; min order check; operating hours check; delegates to OrdersService |
| M13.8 | Order tracking | ✅ DONE | `GET /online/:slug/orders/:orderId?cartToken=...` — cartToken or customerId ownership check |
| M13.9 | Customer order history | ✅ DONE | `GET /online/:slug/my/orders` — customer JWT required; paginated |
| M13.10 | Customer profile update | ✅ DONE | `PATCH /online/:slug/auth/me` — name, phone, password (re-hashed); customer JWT required |
| M13.11 | Restaurant reviews | ✅ DONE | GET (approved only) + POST (JWT required, `isApproved:false` pending moderation); new `Review` model |
| M13.12 | Restaurant discovery | ✅ DONE | `GET /online/restaurants` — city + search filters; publicSlug not null filter; FIRST route to avoid :slug catch-all |

**New module**: `src/online-ordering/` — `OnlineOrderingService`, `OnlineOrderingController`, `OnlineOrderingAuthController`, `CustomerJwtStrategy`, `CustomerJwtAuthGuard`, `CurrentCustomer` decorator, 7 DTOs, `OnlineOrderingModule`
**Schema changes** (db push): `publicSlug String? @unique`, `deliveryFee`, `minimumOrderAmount`, `deliveryRadiusKm`, `estimatedDeliveryMin` on Restaurant; `passwordHash`, `isVerified`, `lastLoginAt` on Customer; `deliveryAddress Json?`, `cartToken String?` on Order; new `Review` model
**Customer JWT**: Separate `CustomerJwtStrategy` (passport strategy name `customer-jwt`) with `type: 'customer'` discriminator; does NOT share guard with staff JwtAuthGuard
**Route ordering**: `GET /online/restaurants` (static) declared FIRST in controller — before `:slug` catch-all routes (same lesson as M12)
**Operating hours**: `isRestaurantOpen()` helper converts current time to restaurant timezone using `toLocaleString('en-US', {timeZone})`
**Cart token persistence**: `cartToken` stored on Order for guest tracking; lookup supports both cartToken and customerId ownership

### M13 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `GET /online/restaurants` → list with meta.total: 1, publicSlug: "spicegarden"
- [x] `GET /online/spicegarden` → restaurant name, deliveryFee, minimumOrderAmount, estimatedDeliveryMin
- [x] `GET /online/spicegarden/menu` → 8 categories with items + modifiers
- [x] `GET /online/spicegarden/menu/items/item-singara` → "Vegetable Singara" with modifierGroups
- [x] `POST /online/spicegarden/auth/register` → accessToken + customer{id, firstName, email}
- [x] `POST /online/spicegarden/auth/login` → accessToken returned
- [x] `GET /online/spicegarden/auth/me` (customer JWT) → email: arif.m13@test.com
- [x] `GET /online/spicegarden/cart/init?restaurantId=...` → cartToken UUID
- [x] `POST /online/spicegarden/cart/items?restaurantId=...` → cart.items: 1, subtotal: 100
- [x] `POST /online/spicegarden/orders` TAKEAWAY → ORD-00014, order.channel: TAKEAWAY
- [x] `GET /online/spicegarden/orders/:orderId?cartToken=...` → orderNumber: ORD-00014
- [x] `GET /online/spicegarden/my/orders` (customer JWT) → meta.total: 0 (guest order, no customerId)
- [x] `PATCH /online/spicegarden/auth/me` → firstName: "Arif Updated"
- [x] `GET /online/spicegarden/reviews` → empty array (no approved reviews)
- [x] `POST /online/spicegarden/reviews` (customer JWT) → id, rating: 4, isApproved: false

### M14 — Online Ordering Payments ✅ BACKEND COMPLETE (2026-02-27)

| ID | Sub-Component | Status | Notes |
|----|--------------|--------|-------|
| M14.1 | Initiate payment (STRIPE/SSLCOMMERZ/BKASH/COD) | ✅ DONE | `POST /online/:slug/orders/:orderId/pay` — gateway path creates OnlinePaymentSession (30-min TTL); COD path immediate COMPLETED + ACCEPTED; double-payment prevention |
| M14.2 | Payment confirmation webhook | ✅ DONE | `POST /online/payments/confirm` — public endpoint; idempotent via `webhookProcessed` flag; SUCCESS→COMPLETED+ACCEPTED; FAILED/CANCELLED→status update |
| M14.3 | Get payment status | ✅ DONE | `GET /online/:slug/orders/:orderId/payment` — expired flag; sessionData for frontend recovery |
| M14.4 | COD confirm (staff) | ✅ DONE | `PATCH /restaurants/:restaurantId/orders/:orderId/payments/cod/confirm` — CASHIER+; moves order ACCEPTED→COMPLETED |
| M14.5 | Customer refund request | ✅ DONE | `POST /online/:slug/orders/:orderId/refund` — customer JWT required; COMPLETED orders only; gateway payments only (no COD refunds); creates PENDING refund |
| M14.6 | Staff refund approval | ✅ DONE | `PATCH /restaurants/:restaurantId/payments/:paymentId/refunds/:refundId/approve` — MANAGER+; PENDING→COMPLETED; updates payment PARTIALLY_REFUNDED/REFUNDED |
| M14.7 | Customer payment history | ✅ DONE | `GET /online/:slug/my/payments` — customer JWT; paginated; includes order summary |
| M14.8 | Gateway mock service | ✅ DONE | `OnlinePaymentGatewayService` — mock Stripe (clientSecret), SSLCommerz (sessionKey+redirectUrl), bKash (bkashURL); `generateGatewayTxId()` per gateway |
| M14.9 | Webhook security | ✅ DONE | `POST /online/payments/webhook/:gateway` — HMAC-SHA256 via `verifyWebhookSignature()`; `crypto.timingSafeEqual`; missing/invalid sig → 400 |
| M14.10 | Online payment analytics | ✅ DONE | `GET /restaurants/:restaurantId/online-payments/analytics` — gateway breakdown, conversion rate, failed rate; 5-min Redis cache; filters by onlineSession presence |

**New files**: `src/online-ordering/payments/` — `OnlinePaymentsService`, `OnlinePaymentsController`, `OnlinePaymentsWebhookController`, `OnlinePaymentsStaffController`, `OnlinePaymentGatewayService`, `webhook-signature.util.ts`, 4 DTOs
**Modified `PaymentsService`**: Added `confirmCodPayment()` (M14.4) and `approveOnlineRefund()` (M14.6)
**Modified `payments.controller.ts`**: Added `PATCH /cod/confirm` (M14.4) and `PATCH /:paymentId/refunds/:refundId/approve` (M14.6)
**Schema change** (db push): `OnlinePaymentSession` model — gateway, sessionData (Json), expiresAt, `webhookProcessed Boolean @default(false)`
**Bug fix**: `placeOnlineOrder` now passes `customerId` in the DTO (not as userId arg); controller uses `OptionalCustomerJwtAuthGuard`
**Analytics fix**: Identifies online payments by `onlineSession` presence or `gatewayName='cod'` (not by `channel: ONLINE` which was unreliable)
**Webhook controller route ordering**: `OnlinePaymentsWebhookController` (`@Controller('online/payments')`) registered FIRST in module — before parametric `OnlinePaymentsController` (`@Controller('online/:slug')`)

### M14 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] `POST /online/:slug/orders/:orderId/pay` (STRIPE) → type: GATEWAY, clientSecret present
- [x] `POST /online/:slug/orders/:orderId/pay` (BKASH) → type: GATEWAY, bkashURL present
- [x] `POST /online/:slug/orders/:orderId/pay` (SSLCOMMERZ) → type: GATEWAY, sessionKey+redirectUrl present
- [x] `POST /online/:slug/orders/:orderId/pay` (COD) → type: COD, payment.status: COMPLETED, order.status: ACCEPTED
- [x] `POST /online/payments/confirm` → alreadyProcessed: false, status: COMPLETED; order→ACCEPTED
- [x] `POST /online/payments/confirm` (repeat) → alreadyProcessed: true (idempotent)
- [x] `GET /online/:slug/orders/:orderId/payment` → hasPendingPayment: true, gatewayName, status
- [x] `PATCH /restaurants/:restaurantId/orders/:orderId/payments/cod/confirm` → order.status: COMPLETED
- [x] `POST /online/:slug/orders/:orderId/refund` (customer JWT) → refund.status: PENDING
- [x] `PATCH /restaurants/:restaurantId/payments/:paymentId/refunds/:refundId/approve` → refund.status: COMPLETED
- [x] `GET /online/:slug/my/payments` → HTTP 200, meta.total (paginated)
- [x] `POST /online/payments/webhook/:gateway` (valid HMAC-SHA256 sig) → result: alreadyProcessed/COMPLETED
- [x] `POST /online/payments/webhook/:gateway` (invalid sig) → 400 Invalid webhook signature
- [x] `POST /online/payments/webhook/:gateway` (missing sig) → 400 Missing X-Gateway-Signature header
- [x] `GET /restaurants/:restaurantId/online-payments/analytics` → totalRevenue, ordersPlaced, conversion rate, byGateway

---

### M15 — Enhanced Customer Experience ✅ BACKEND COMPLETE (2026-02-27)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M15.1 | Auto-earn loyalty on online order payment | ✅ DONE | Injected into `OnlinePaymentsService`; fires after COD + gateway SUCCESS; floor(total/10) pts; non-blocking `.catch()` |
| M15.2 | Loyalty redemption at checkout | ✅ DONE | `redeemPoints` field in `PlaceOnlineOrderDto`; calls `redeemForOnlineOrder()` after order creation; reduces `totalAmount` by discount |
| M15.3 | Customer address book | ✅ DONE | `GET/POST /online/:slug/my/addresses`, `PATCH/DELETE /online/:slug/my/addresses/:id`, `PATCH .../default` — customer JWT required |
| M15.4 | Reorder (repeat previous order) | ✅ DONE | `POST /online/:slug/my/reorder/:orderId` — creates new cart from previous order items (skips unavailable items) |
| M15.5 | Customer loyalty dashboard | ✅ DONE | `GET /online/:slug/my/loyalty` — points, tier, totalEarned, totalRedeemed, nextTierThreshold, last-20 transactions |
| M15.6 | Order receipt | ✅ DONE | `GET /online/:slug/my/orders/:orderId/receipt` — full order with items, payments, customer, restaurant details |
| M15.7 | Review moderation (staff) | ✅ DONE | `GET/PATCH /restaurants/:restaurantId/reviews` — list (filter by status/rating), stats, approve, reject — MANAGER+ |
| M15.8 | Saved payment methods | ✅ DONE | `GET/POST/DELETE /online/:slug/my/payment-methods`, `PATCH .../default` — gateway validation (stripe/sslcommerz/bkash/cod) |
| M15.9 | Customer notifications | ✅ DONE | `GET /online/:slug/my/notifications`, `PATCH .../read`, `PATCH .../read-all` — auto-created by `notifyCustomer()` on loyalty events |
| M15.10 | Account deletion (GDPR) | ✅ DONE | `DELETE /online/:slug/my/account` — password confirmation required; cascades to addresses, loyalty, notifications; orders→SetNull |

**New files**:
- `src/online-ordering/loyalty/online-loyalty.service.ts` — M15.1/2/5/8/9 service
- `src/online-ordering/online-customer.controller.ts` — M15.3/4/5/6/8/9/10 customer endpoints
- `src/online-ordering/online-reviews-staff.controller.ts` — M15.7 review moderation
- `src/online-ordering/dto/customer-address.dto.ts` — CreateAddressDto + UpdateAddressDto
- `prisma/schema.prisma` — Added `SavedPaymentMethod` + `CustomerNotification` models

**Key fixes**:
- Online customer registration now auto-creates a `LoyaltyAccount` (BRONZE, 0pts) on sign-up
- `OnlinePaymentsService` injects `OnlineLoyaltyService` for M15.1 trigger
- `OnlineOrderingService` injects `OnlineLoyaltyService` for M15.2 redemption

### M15 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL PASS ✅)

- [x] COD payment → loyalty points auto-earned (M15.1) — 168 pts from 1684 BDT order
- [x] Place order with `redeemPoints:50` → totalAmount reduced by 50, points deducted (M15.2)
- [x] `POST /online/:slug/my/addresses` → address created with isDefault
- [x] `GET /online/:slug/my/addresses` → list returned (M15.3)
- [x] `DELETE /online/:slug/my/addresses/:id` → success (M15.3)
- [x] `PATCH /online/:slug/my/addresses/:id/default` → isDefault: true (M15.3)
- [x] `POST /online/:slug/my/reorder/:orderId` → new cartToken returned (M15.4)
- [x] `GET /online/:slug/my/loyalty` → points/tier/nextTier/transactions (M15.5)
- [x] `GET /online/:slug/my/orders/:orderId/receipt` → orderNumber, items, payments (M15.6)
- [x] `GET /restaurants/:restaurantId/reviews/stats` → total/avgRating (M15.7)
- [x] `GET /restaurants/:restaurantId/reviews?status=pending` → paginated list (M15.7)
- [x] `PATCH /restaurants/:restaurantId/reviews/:id/approve` → isApproved: true (M15.7)
- [x] `PATCH /restaurants/:restaurantId/reviews/:id/reject` → isHidden: true (M15.7)
- [x] `POST /online/:slug/my/payment-methods` → gateway saved (M15.8)
- [x] `GET /online/:slug/my/payment-methods` → list (M15.8)
- [x] `PATCH /online/:slug/my/payment-methods/:id/default` → isDefault: true (M15.8)
- [x] `DELETE /online/:slug/my/payment-methods/:id` → success (M15.8)
- [x] `GET /online/:slug/my/notifications` → total/unread (M15.9)
- [x] `PATCH /online/:slug/my/notifications/:id/read` → isRead: true (M15.9)
- [x] `PATCH /online/:slug/my/notifications/read-all` → updated count (M15.9)
- [x] `DELETE /online/:slug/my/account` → success, subsequent login blocked (M15.10)

---

### M16 — Enhanced Order Management ✅ BACKEND COMPLETE (2026-02-27)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M16.1 | Unified order dashboard (all channels) | ✅ DONE | `GET /orders` returns all channels; `source` filter (pos/qr/online) + `search` (orderNumber, customer name/phone) + `customerId` filter; customer object included in response |
| M16.2 | Accept / Reject actions | ✅ DONE | `PATCH /orders/:id/accept` (PENDING→ACCEPTED); `PATCH /orders/:id/reject` body `{ reason? }` (PENDING→CANCELLED); 400 guard on invalid transition |
| M16.3 | Auto-accept timer per channel | ✅ DONE | `PATCH /restaurants/:id/auto-accept-timer` body `{ pos, qr, online, aggregator }` (minutes, 0=disabled); `GET` reads config; `OrdersCronService` fires every minute via `@nestjs/schedule`; `autoAcceptMinutes Json?` field on Restaurant |
| M16.4 | Customer notification on status change | ✅ DONE | `updateOrderStatus()` creates `CustomerNotification` on ACCEPTED/PREPARING/READY/COMPLETED/CANCELLED for orders with `customerId`; `rejectOrder()` also creates notification |
| M16.5 | Sound alerts | ⏳ FRONTEND | Frontend-only (audio API) |
| M16.6 | Order search and filtering | ✅ DONE | `search` (orderNumber, customer name/phone), `source` (pos/qr/online), `customerId`, `status`, `orderType`, `fromDate`, `toDate`, `page`, `limit` |
| M16.7 | Order printing / print ticket | ✅ DONE | `GET /orders/:id/print-ticket` → `{ restaurantName, restaurantAddress, orderNumber, orderType, channel, tableNumber, items[], subtotal, taxAmount, serviceCharge, totalAmount, payments[], printedAt }` |

**New files**:
- `src/orders/orders-cron.service.ts` — M16.3 auto-accept cron (`@Cron(EVERY_MINUTE)`)
- `src/orders/dto/reject-order.dto.ts` — `{ reason?: string }`

**Modified files**:
- `prisma/schema.prisma` — Added `autoAcceptMinutes Json?` to Restaurant
- `src/orders/dto/list-orders-query.dto.ts` — Added `search`, `source`, `customerId` fields
- `src/orders/orders.service.ts` — Enhanced `listOrders`, added `acceptOrder()`, `rejectOrder()`, `getPrintTicket()`, `autoAcceptPendingOrders()`, M16.4 notification hook in `updateOrderStatus()`
- `src/orders/orders.controller.ts` — Added `PATCH /:id/accept`, `PATCH /:id/reject`, `GET /:id/print-ticket`
- `src/orders/orders.module.ts` — Added `PrismaModule`, `OrdersCronService`
- `src/restaurants/restaurants.service.ts` — Added `updateAutoAcceptTimer()`, `getAutoAcceptTimer()`
- `src/restaurants/restaurants.controller.ts` — Added `PATCH /:id/auto-accept-timer`, `GET /:id/auto-accept-timer`
- `src/app.module.ts` — Added `ScheduleModule.forRoot()` for cron support

**Key notes**:
- Source detection: `pos` = `cartToken: null` + channel ≠ QR; `qr` = channel = QR; `online` = `cartToken: { not: null }` + channel ≠ QR
- `ScheduleModule.forRoot()` must be in `AppModule` for `@Cron` decorators to activate
- Cron service ran cleanly for 65+ seconds; server remained healthy after cron activation

### M16 VERIFICATION CHECKLIST (Verified 2026-02-27 — ALL BACKEND CHECKS PASS ✅)

- [x] `GET /orders` → total: 31, customer included in response (M16.1)
- [x] `GET /orders?source=online` → 18 online orders (M16.1)
- [x] `GET /orders?search=ORD-00030` → found specific order (M16.6)
- [x] `GET /orders?status=PENDING&source=pos` → filtered list (M16.6)
- [x] `GET /orders?fromDate=2026-01-01&toDate=2026-12-31` → date range filter (M16.6)
- [x] `PATCH /orders/:id/accept` → PENDING→ACCEPTED (M16.2)
- [x] `PATCH /orders/:id/reject` → PENDING→CANCELLED (M16.2)
- [x] `PATCH /orders/:id/reject` on non-PENDING → 400 error (M16.2 guard)
- [x] `PATCH /restaurants/:id/auto-accept-timer` body `{qr:3,online:5}` → saved (M16.3)
- [x] `GET /restaurants/:id/auto-accept-timer` → returns autoAccept + autoAcceptMinutes (M16.3)
- [x] `OrdersCronService` registered + `handleAutoAccept()` runs every minute (M16.3)
- [x] Order status change → CustomerNotification created (M16.4, PREPARING confirmed)
- [x] `GET /orders/:id/print-ticket` → restaurantName, orderNumber, items, subtotal, taxAmount, totalAmount, payments, printedAt (M16.7)
- [ ] Sound alerts on new order (M16.5) — Frontend only, deferred

---

### M17 — Aggregator Integration Hub ✅ BACKEND COMPLETE (2026-02-28)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M17.1 | Aggregator abstraction layer | ✅ DONE | `IAggregatorAdapter` interface; `AggregatorFactory` returns adapter by platform name; `GET /restaurants/:id/aggregators/platforms` → `['foodpanda','pathao']` |
| M17.2 | Foodpanda: receive orders | ✅ DONE | `FoodpandaAdapter.parseWebhookOrder()` normalizes Foodpanda webhook payload; idempotent via `externalOrderId` |
| M17.3 | Foodpanda: send status updates | ✅ DONE | `FoodpandaAdapter.updateStatus()` (mock); called non-blocking on accept/reject |
| M17.4 | Foodpanda: menu sync | ✅ DONE | `POST /restaurants/:id/aggregators/connections/:connId/sync-menu` → synced 12 items |
| M17.5 | Pathao: receive orders | ✅ DONE | `PathaoAdapter.parseWebhookOrder()` normalizes Pathao format (order_items, merchant_order_amount) |
| M17.6 | Pathao: send status updates | ✅ DONE | `PathaoAdapter.updateStatus()` (mock); called on reject |
| M17.7 | Pathao: menu sync | ✅ DONE | Same endpoint as M17.4 but for pathao connection |
| M17.8 | Aggregator badge + commission in order list | ⏳ FRONTEND | `aggregatorName` + `externalOrderId` on Order available; frontend renders badge |
| M17.9 | Accept / reject with reason codes | ✅ DONE | `PATCH /restaurants/:id/aggregators/orders/:orderId/accept` (PENDING→ACCEPTED + notifies platform); `PATCH .../reject` body `{reasonCode, reasonText}` (PENDING→CANCELLED + notifies platform) |
| M17.10 | Auto-accept config per aggregator | ✅ DONE | `autoAccept: Boolean` on `AggregatorConnection`; checked in `receiveWebhookOrder()` — ACCEPTED immediately if true; configured via `PATCH connections/:id` |
| M17.11 | Auto-print aggregator order tickets | ✅ DONE | `GET /restaurants/:id/orders/:orderId/print-ticket` returns full ticket with `aggregatorName`, `externalOrderId`, `guestName`, item name snapshots |
| M17.12 | Menu availability sync (all aggregators) | ✅ DONE | `POST /restaurants/:id/aggregators/sync-all-menus` → `Promise.allSettled` across all active connections; reports per-platform results |
| M17.13 | Operating hours sync | ✅ DONE | `POST /restaurants/:id/aggregators/connections/:connId/sync-hours` → pushes `restaurant.operatingHours` to platform |
| M17.14 | Commission tracking per aggregator | ✅ DONE | `GET connections/:connId/commission?fromDate&toDate` → totalOrders, totalRevenue, totalCommission, netRevenue; PERCENTAGE and FIXED types; verified: 720 BDT × 15% = 108 BDT |
| M17.15 | Revenue comparison across aggregators | ✅ DONE | `GET /restaurants/:id/aggregators/revenue-report` → per-platform breakdown + summary; includes platforms with 0 orders |
| M17.16 | Webhook receiver | ✅ DONE | `POST /aggregators/webhook/:platform/:restaurantId` — public endpoint; HMAC `X-Aggregator-Signature` verification when `webhookSecret` configured; idempotent |
| M17.17 | Connection setup (CRUD + test) | ✅ DONE | Full CRUD: `POST/GET/PATCH/DELETE /restaurants/:id/aggregators/connections`; `POST .../test` validates API key (mock) + updates `isConnected`; prevents duplicate platform connections |

**New files**:
- `src/aggregators/interfaces/aggregator-adapter.interface.ts` — M17.1 IAggregatorAdapter
- `src/aggregators/adapters/foodpanda.adapter.ts` — M17.2/3/4 (mock)
- `src/aggregators/adapters/pathao.adapter.ts` — M17.5/6/7 (mock)
- `src/aggregators/aggregator.factory.ts` — M17.1 platform lookup
- `src/aggregators/dto/create-connection.dto.ts`, `update-connection.dto.ts`, `reject-aggregator-order.dto.ts`, `aggregator-report.dto.ts`
- `src/aggregators/aggregators.service.ts` — all M17 business logic
- `src/aggregators/aggregators.controller.ts` — protected MANAGER+ endpoints
- `src/aggregators/aggregators-webhook.controller.ts` — public webhook receiver

**Modified files**:
- `prisma/schema.prisma` — Added `AggregatorConnection` model; made `OrderItem.itemId` nullable (for external orders)
- `src/aggregators/aggregators.module.ts` — Full rewrite with all providers
- `src/app.module.ts` — Added `AggregatorsModule`
- `src/orders/orders.service.ts` — Fixed `getPrintTicket` to use `oi.name` snapshot fallback + added `aggregatorName`, `externalOrderId`, `guestName` to ticket

**Key design**:
- `AggregatorConnection` per-restaurant per-platform; `platform` is lowercase identifier string
- `OrderItem.itemId` nullable — aggregator orders have no internal item IDs; name stored in `name` snapshot field
- Modifier info encoded in `OrderItem.notes` (e.g. "Extra Raita (+30)") for aggregator orders
- `AggregatorsModule` is fully independent from `OrdersModule` (no circular deps)
- Webhook controller registered first (public, no auth) before the protected controller

### M17 VERIFICATION CHECKLIST (Verified 2026-02-28 — ALL BACKEND CHECKS PASS ✅)

- [x] `GET /restaurants/:id/aggregators/platforms` → `['foodpanda','pathao']` (M17.1)
- [x] `POST /aggregators/webhook/foodpanda/:restaurantId` → ORD-00036 PENDING, channel=AGGREGATOR, aggregatorName=foodpanda (M17.2/M17.16)
- [x] `PATCH /restaurants/:id/aggregators/orders/:orderId/accept` → PENDING→ACCEPTED + mock Foodpanda notified (M17.3/M17.9)
- [x] `POST /restaurants/:id/aggregators/connections/:connId/sync-menu` → 12 items synced to Foodpanda (M17.4)
- [x] `POST /aggregators/webhook/pathao/:restaurantId` → ORD-00037 PENDING, aggregatorName=pathao (M17.5/M17.16)
- [x] `PATCH .../reject` → PENDING→CANCELLED + mock Pathao notified (M17.6/M17.9)
- [x] `POST .../sync-menu` (Pathao) → 12 items synced (M17.7)
- [x] `PATCH .../reject` body `{reasonCode:'OUT_OF_STOCK'}` → cancelReason preserved (M17.9)
- [x] `PATCH .../reject` on non-PENDING → 400 error (M17.9 guard)
- [x] `autoAccept:true` on connection → webhook order auto-accepted (status=ACCEPTED) (M17.10)
- [x] `GET /orders/:id/print-ticket` for aggregator order → aggregatorName, guestName, item name snapshots (M17.11)
- [x] `POST /restaurants/:id/aggregators/sync-all-menus` → foodpanda: 12, pathao: 12 synced (M17.12)
- [x] `POST .../sync-hours` → `{success:true, platform:'foodpanda'}` (M17.13)
- [x] `GET .../commission?` → 1 order, revenue=720, commission=108 (15% of 720), net=612 (M17.14)
- [x] `GET .../revenue-report` → foodpanda: 1 order/720 revenue/108 commission; pathao: 0 orders (M17.15)
- [x] Webhook with valid HMAC `X-Aggregator-Signature` → accepted (M17.16)
- [x] Webhook with invalid HMAC → 400 Invalid webhook signature (M17.16)
- [x] Duplicate webhook (same `externalOrderId`) → `{duplicate:true}` idempotent (M17.16)
- [x] `POST /restaurants/:id/aggregators/connections` (foodpanda+pathao) → created with all fields (M17.17)
- [x] `POST .../test` → `{success:true, message:'Foodpanda connection verified (mock)'}` + isConnected=true (M17.17)
- [x] `PATCH .../connections/:id` → fields updated (M17.17)
- [x] `GET .../connections` → lists both connections with lastOrderAt (M17.17)
- [ ] Aggregator badge + commission UI (M17.8) — Frontend deferred
- [ ] Auto-accept amount threshold UI (M17.10 UI part) — Frontend deferred

---

### M18 — Delivery Management ✅ FULL-STACK COMPLETE (2026-02-28)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M18.1 | Delivery zone CRUD | ✅ DONE | `GET/POST/PATCH/DELETE /restaurants/:id/delivery/zones` — MANAGER+; name, minOrderAmount, deliveryFee, estimatedMinutes, isActive; per-restaurant isolation |
| M18.2 | Driver management (CRUD) | ✅ DONE | `GET/POST/PATCH/DELETE /restaurants/:id/delivery/drivers` — MANAGER+; name, phone, vehicleType (BICYCLE/MOTORCYCLE/CAR/VAN); isActive toggle |
| M18.3 | Create delivery | ✅ DONE | `POST /restaurants/:id/delivery` — MANAGER+; links orderId → delivery; initial status PENDING; emits `delivery:created` realtime event |
| M18.4 | List deliveries | ✅ DONE | `GET /restaurants/:id/delivery` — filters: status, driverId, dateFrom, dateTo, page, limit |
| M18.5 | Assign driver | ✅ DONE | `PATCH /restaurants/:id/delivery/:id/assign` — MANAGER+; PENDING→ASSIGNED; emits `delivery:status-changed` |
| M18.6 | Manager state machine | ✅ DONE | `PATCH .../status` — MANAGER state machine: PENDING→ASSIGNED\|FAILED\|CANCELLED; ASSIGNED→PICKED_UP\|FAILED\|CANCELLED; PICKED_UP→IN_TRANSIT; IN_TRANSIT→DELIVERED\|FAILED\|CANCELLED |
| M18.7 | Driver self-service | ✅ DONE | `PATCH .../driver-status` — DRIVER role only; restricted transitions: ASSIGNED→PICKED_UP→IN_TRANSIT→DELIVERED only; cannot cancel or mark failed |
| M18.8 | Location tracking | ✅ DONE | `POST .../location` (driver updates) + `GET .../location` (manager/public read); Redis key `driver:{driverId}:location` TTL 300s; returns `{isOnline, lastLocation}` |
| M18.9 | Public order tracking | ✅ DONE | `GET /delivery/track/:deliveryId` — no auth; status + driver first name + estimated minutes; `DeliveryPublicController` registered FIRST to avoid route conflicts |
| M18.10 | Delivery analytics | ✅ DONE | `GET /restaurants/:id/delivery/analytics` — MANAGER+; Redis cache 120s; deliveriesByStatus, avgDeliveryMinutes, successRatePercent, driverLeaderboard (top 5), zoneCoverage |

**New module**: `src/delivery/` — `DeliveryZone`, `Driver`, `Delivery` models + `DeliveryStatus` enum (via `prisma db push`)
**Architecture**: `DeliveryPublicController` (`GET /delivery/track/:id`, no guards) registered BEFORE `DeliveryController` (`/restaurants/:id/delivery`, JWT+Tenant+Roles)
**Realtime**: `emitToRestaurant()` added to `RealtimeService`; events: `delivery:created`, `delivery:status-changed`, `delivery:driver-location`
**Schema**: `DeliveryZone` + `Driver` + `Delivery` models added; `DeliveryStatus` enum: PENDING, ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED, CANCELLED
**Test data**: Zone id `eeb2af01`; Driver `rahim.driver@test.com`/`Driver@1234` (id `341e6196`); Delivery `901b61eb` (status PICKED_UP, order `be33570c`)

**Frontend**: `frontend-dashboard/src/pages/delivery/DeliveryPage.tsx` — 4-tab page
- **Deliveries tab**: Paginated table with status badges, assign driver dialog, status update buttons
- **Zones tab**: Zone list with CRUD dialogs (create/edit/delete)
- **Drivers tab**: Driver list with CRUD, isActive toggle
- **Analytics tab**: CSS bar charts for deliveries by status, success rate, avg delivery time, driver leaderboard

### M18 VERIFICATION CHECKLIST (Verified 2026-02-28 — ALL PASS ✅)

- [x] `POST /restaurants/:id/delivery/zones` → zone created with deliveryFee, estimatedMinutes
- [x] `GET /restaurants/:id/delivery/zones` → list with isActive toggle
- [x] `PATCH/DELETE /restaurants/:id/delivery/zones/:id` → update/delete zone
- [x] `POST /restaurants/:id/delivery/drivers` → driver created (MOTORCYCLE)
- [x] `GET /restaurants/:id/delivery/drivers` → list with vehicleType
- [x] `POST /restaurants/:id/delivery` (orderId) → delivery PENDING created
- [x] `PATCH /restaurants/:id/delivery/:id/assign` (driverId) → status ASSIGNED, driverId set
- [x] `PATCH /restaurants/:id/delivery/:id/status` PICKED_UP → status transitions correctly
- [x] `PATCH /restaurants/:id/delivery/:id/driver-status` (driver JWT) → DRIVER can advance own deliveries
- [x] `PATCH /restaurants/:id/delivery/:id/driver-status` CANCEL attempt → 400 (driver cannot cancel)
- [x] `POST /restaurants/:id/delivery/:id/location` → lat/lng stored in Redis
- [x] `GET /restaurants/:id/delivery/:id/location` → `{isOnline:true, lastLocation:{lat,lng}}`
- [x] `GET /delivery/track/:deliveryId` (no auth) → status, driverFirstName, estimatedMinutes
- [x] `GET /restaurants/:id/delivery/analytics` → successRatePercent, avgDeliveryMinutes, driverLeaderboard
- [x] `/delivery` route in frontend-dashboard → DeliveryPage loads with 4 tabs
- [x] Truck icon visible in Sidebar "Operations" section

---

### M19 — Reporting & Analytics ✅ FULL-STACK COMPLETE (2026-02-28)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M19.1 | Dashboard KPIs (frontend) | ✅ DONE | 4 KPI cards: Total Revenue, Orders, Avg Order Value, New Customers — each with period-change % badge (green ↑ / red ↓); vs-yesterday callout bar |
| M19.2 | Sales by channel (frontend) | ✅ DONE | CSS horizontal progress bars coloured by channel (DINE_IN/TAKEAWAY/DELIVERY/QR/ONLINE); order count + revenue label |
| M19.3 | Sales by payment method (frontend) | ✅ DONE | CSS horizontal bars; CASH=green, CARD=blue, MOBILE_BANKING=purple, ONLINE=indigo; transaction count + revenue |
| M19.4 | Hourly heatmap (frontend) | ✅ DONE | recharts `BarChart` — 24 bars (00:00–23:00), brand-orange fill, peak hour callout badge |
| M19.5 | Top items table (frontend) | ✅ DONE | Table rows: rank, name, qty sold (bold), revenue; #1 row highlighted orange-50 |
| M19.6 | Daily revenue trend (frontend) | ✅ DONE | recharts `LineChart` — dual Y-axis (revenue left, orders right), date x-axis, `Tooltip` showing both values |
| M19.7 | Aggregator commissions tab (frontend) | ✅ DONE | Summary KPI cards (total orders/revenue/commission); per-platform table with commission %, net revenue, CSS net-revenue bar |
| M19.8 | CSV export (backend + frontend) | ✅ DONE | `GET /restaurants/:id/analytics/export?dateFrom&dateTo` → `text/csv` attachment; 5 sections: Revenue Summary, Daily Breakdown, Sales by Channel, Payment Methods, Top 20 Items; frontend blob download via axios `responseType:'blob'` |
| M19.9 | Nightly email report cron | ✅ DONE | `@Cron('0 23 * * *')` in `AnalyticsCronService`; per-restaurant try-catch; fetches today KPIs + top 3 items; HTML email to OWNER users via `EmailService`; dev mode logs to console |

**New backend files**:
- `src/analytics/dto/export-query.dto.ts` — `ExportQueryDto` with optional `dateFrom`/`dateTo`
- `src/analytics/analytics-export.service.ts` — parallel M9 calls → multi-section CSV string
- `src/analytics/analytics-cron.service.ts` — nightly email cron + `buildEmailHtml()` private method

**Modified backend files**:
- `src/analytics/analytics.controller.ts` — `GET export` route added FIRST (static, before any parameterized routes); injects `AnalyticsExportService`
- `src/analytics/analytics.module.ts` — Added `PrismaModule` import; `AnalyticsExportService` + `AnalyticsCronService` as providers; `EmailModule` is `@Global()` so no explicit import needed

**New frontend files**:
- `src/types/analytics.types.ts` — Full TypeScript interfaces for all M9 + M17 response shapes
- `src/lib/analytics.api.ts` — 8 typed API methods including blob CSV download
- `src/pages/reports/ReportsPage.tsx` — 4-tab page (Summary / Breakdown / Aggregators / Export)

**Modified frontend files**:
- `src/router/index.tsx` — `/reports` now loads `ReportsPage` (was `ComingSoonPage`)

**Key notes**:
- `GET export` declared BEFORE other routes in controller — same static-before-parameterized lesson as M12/M13/M17/M18
- recharts `LineChart` (dual-axis) + `BarChart` (hourly): use `stroke`/`fill` props for brand colour (#ff6b35), not Tailwind classes
- Aggregator tab uses `fromDate`/`toDate` params (not `dateFrom`/`dateTo`) — matches M17 `AggregatorReportDto`
- Cron uses `ScheduleModule` already registered in `AppModule` from M16

### M19 VERIFICATION CHECKLIST (Verified 2026-02-28 — ALL PASS ✅)

- [x] `GET /restaurants/:id/analytics/dashboard` → `{today:{revenue,orders,avgOrderValue}, vsYesterday:{revenueChange}}`
- [x] `GET /restaurants/:id/analytics/orders/by-channel` → `[{channel,orders,revenue}]`
- [x] `GET /restaurants/:id/analytics/payments/by-method` → `[{method,transactions,revenue,percentage}]`
- [x] `GET /restaurants/:id/analytics/orders/hourly` → `{heatmap:[24 slots],peakHour:{hour,label,orders}}`
- [x] `GET /restaurants/:id/analytics/menu/top-items?limit=10` → `[{rank,name,totalQty,totalRevenue}]`
- [x] `GET /restaurants/:id/analytics/revenue?dateFrom=2026-02-01&dateTo=2026-02-28` → `{totalRevenue,daily:[...]}`
- [x] `GET /restaurants/:id/aggregators/revenue-report?fromDate=2026-02-01&toDate=2026-02-28` → `{platforms:[...],summary:{...}}`
- [x] `GET /restaurants/:id/analytics/export?dateFrom=2026-02-01&dateTo=2026-02-28` → HTTP 200, Content-Type:text/csv, Content-Disposition:attachment
- [x] CSV content has 5 sections: "Revenue Summary", "Daily Breakdown", "Sales by Channel", "Sales by Payment Method", "Top Items"
- [x] `/reports` route in frontend-dashboard → ReportsPage loads (no ComingSoonPage)
- [x] Summary tab: 4 KPI cards + dual-axis line chart render with live data
- [x] Breakdown tab: channel bars, payment bars, 24-bar hourly chart, top items table all populate
- [x] Aggregators tab: platform table with commission % and net revenue bars
- [x] Export tab: "Download CSV" triggers file download; "Print / Save as PDF" opens browser print dialog
- [x] `npm run build` (frontend-dashboard) → passes clean, ReportsPage chunk 387 kB
- [x] `tsc --noEmit` (backend) → 0 errors

---

## Progress Summary

| Tier | Module | Status | Completion |
|------|--------|--------|-----------|
| T0 | M0 Foundation | ✅ COMPLETE | 26/27 (M0.4.3 staging deferred) |
| T1 | M1 Auth & Users | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M2 Restaurant Config | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M3 Menu Management | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M4 Order Engine | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M5 POS System | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M6 KDS | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M7 Payments | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M8 Customers | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M9 Analytics | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T1 | M10 Super Admin | ✅ BACKEND COMPLETE | 13/13 sub-components |
| T1 | M11 Notifications | ✅ BACKEND COMPLETE | 13/13 sub-components |
| T2 | M12 QR Table Ordering | ✅ BACKEND COMPLETE | 12/12 sub-components |
| T2 | M13 Online Ordering | ✅ BACKEND COMPLETE | 12/12 sub-components |
| T2 | M14 Online Ordering Payments | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T2 | M15 Enhanced Customer Experience | ✅ BACKEND COMPLETE | 10/10 sub-components |
| T2 | M16 Enhanced Order Management | ✅ BACKEND COMPLETE | 6/7 backend (M16.5 frontend only) |
| T3 | M17 Aggregator Integration Hub | ✅ BACKEND COMPLETE | 14/17 backend (M17.8/M17.10UI/M17.11partial frontend) |
| T3 | M18 Delivery Management | ✅ FULL-STACK COMPLETE | 10/10 backend + frontend (DeliveryPage 4-tab) |
| T3 | M19 Reporting & Analytics | ✅ FULL-STACK COMPLETE | 9/9 (6 backend endpoints + CSV export + cron + 4-tab ReportsPage) |
| T4 | M20–M23 | ⏳ PENDING | Inventory, CRM, Staff HR, Owner Mobile App |
| T5–6 | M24–M43 | ⏳ PLANNED | Scale & Ecosystem tier |

---

## UI PHASE 1 — Frontend Scaffold ✅ COMPLETE (2026-02-27)

### All 3 Frontend Apps Initialized

| App | Stack | Port | Status |
|-----|-------|------|--------|
| `frontend-dashboard/` | Vite + React 18 + TS + Tailwind + shadcn/ui + Zustand + TanStack Query + React Router v7 | 3001 | ✅ Builds + Type-checks |
| `frontend-superadmin/` | Vite + React 18 + TS + Tailwind + shadcn/ui + Zustand + TanStack Query + React Router v7 | 3003 | ✅ Builds + Type-checks |
| `frontend-ordering/` | Next.js 15 App Router + TS + Tailwind | 3002 | ✅ Builds + Type-checks |

### frontend-dashboard — Completed Components

| Component | Status | Notes |
|-----------|--------|-------|
| Vite + React 18 + TS config | ✅ | vite.config.ts, tsconfig.app.json, tsconfig.node.json |
| Tailwind + shadcn/ui design tokens | ✅ | Brand orange (#ff6b35), dark sidebar (#1A1D23), CSS vars |
| shadcn/ui primitives | ✅ | button, input, label, card, badge, separator, avatar, dialog, dropdown-menu, scroll-area, tooltip |
| Zustand stores | ✅ | auth.store.ts (persist), ui.store.ts (sidebar state) |
| Axios API client + refresh interceptor | ✅ | Auto-refresh on 401, token queue for concurrent requests |
| TanStack Query v5 client | ✅ | 5min stale, no retry on 4xx |
| React Router v7 routes | ✅ | All module stubs: /dashboard, /pos, /kds, /menu/*, /tables, /orders, /payments, /staff, /settings |
| AppLayout (auth guard + sidebar + mobile) | ✅ | Desktop sidebar + mobile overlay |
| Sidebar (collapsible + nav + user) | ✅ | All 5 sections, collapse toggle, logout |
| TopBar | ✅ | Breadcrumbs, search, notifications, user |
| PageShell (content wrapper) | ✅ | max-w-7xl, title + actions slot |
| **Auth: LoginPage** | ✅ | identifier + password, 2FA redirect, PIN link |
| **Auth: RegisterPage** | ✅ | 7-field form, password strength checker |
| **Auth: ForgotPasswordPage** | ✅ | Email form + sent confirmation state |
| **Auth: ResetPasswordPage** | ✅ | Token from URL, password strength checker |
| **Auth: PinLoginPage** | ✅ | Numeric keypad, PIN dots, dark POS terminal design |
| **Auth: TwoFactorPage** | ✅ | 6-digit TOTP code, mono input |
| DashboardPage | ✅ | KPI cards (placeholder), module status badges |
| ComingSoonPage | ✅ | Shown on remaining stub routes |
| **M3: CategoriesPage** | ✅ | Category list + create/edit/delete dialogs |
| **M3: ItemsPage** | ✅ | Items tab (CRUD) + Modifier Groups tab |
| **M5: POSPage** | ✅ | 3-panel POS layout (categories + items + cart), table session |
| **M6: KDSPage** | ✅ | Real-time order cards, kitchen status buttons |
| **M4/M16: OrdersPage** | ✅ | Unified order list, filters, accept/reject, print ticket |
| **M18: DeliveryPage** | ✅ | 4 tabs: Deliveries / Zones / Drivers / Analytics; Truck icon in Sidebar |
| **M19: ReportsPage** | ✅ | 4 tabs: Summary (KPIs + LineChart) / Breakdown (bars + BarChart + top items) / Aggregators / Export (CSV + Print) |

### frontend-superadmin — Completed Components

| Component | Status | Notes |
|-----------|--------|-------|
| Vite + React 18 + TS config | ✅ | Port 3002 |
| Indigo brand tokens + dark navy sidebar | ✅ | |
| Zustand auth store (SUPER_ADMIN role) | ✅ | Fixed role string: `SUPER_ADMIN` (not `SUPERADMIN`) |
| Axios API client + envelope unwrap | ✅ | All calls unwrap `{ success, data }` |
| AppLayout (SUPER_ADMIN role guard) | ✅ | Fixed role check in guard |
| Sidebar (5 nav items) | ✅ | Dashboard, Tenants, Analytics, Audit Log, Admin Users |
| `src/types/superadmin.types.ts` | ✅ | Full TypeScript interfaces for all M10 API shapes |
| `src/lib/superadmin.api.ts` | ✅ | 13 typed API calls (KPIs, health, tenants, audit, users) |
| shadcn/ui: dialog, badge, textarea | ✅ | Added to `components/ui/` |
| **Auth: LoginPage** | ✅ | Envelope unwrap + `/auth/me` profile fetch + role guard |
| **DashboardPage** | ✅ | Live KPI cards (tenants/restaurants/users/orders/revenue) + health bar (DB & Redis latency) |
| **TenantsPage** | ✅ | Paginated table, search + plan/status filters, suspend/activate, inline plan change, detail dialog (restaurants + users sub-lists), impersonate dialog with copyable token |
| **AnalyticsPage** | ✅ | Date range picker, day/week/month group-by toggle, summary cards, revenue data table |
| **AuditLogPage** | ✅ | Paginated table, color-coded action badges, metadata preview, timestamp |
| **UsersPage** | ✅ | Super admin list, Add dialog (firstName/lastName/email/password), Deactivate button (self-disabled) |

### frontend-ordering — Completed Components

| Component | Status |
|-----------|--------|
| Next.js 15 App Router + TS config | ✅ |
| Tailwind + brand tokens | ✅ |
| app/layout.tsx (metadata, PWA theme-color) | ✅ |
| app/page.tsx (home with route map) | ✅ |
| app/[restaurantSlug]/page.tsx (M13 stub) | ✅ |
| app/table/[restaurantId]/[tableId]/page.tsx (M12 stub) | ✅ |

### Dev Commands

```bash
# Dashboard (Restaurant Admin + POS)
cd frontend-dashboard && npm run dev        # http://localhost:3001

# Super Admin
cd frontend-superadmin && npm run dev       # http://localhost:3002

# Customer Ordering
cd frontend-ordering && npm run dev         # http://localhost:3000 (Next.js default)
```

---

## TIER 4: BACK-OFFICE

### M20 — Inventory & Stock Management ✅ FULL-STACK COMPLETE (2026-02-28)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M20.1 | Inventory item CRUD | ✅ DONE | `GET/POST/PATCH/DELETE /restaurants/:id/inventory` — MANAGER+; name, unit, currentStock, minStockLevel, costPerUnit |
| M20.2 | Stock adjustment | ✅ DONE | `POST /inventory/:id/adjust` — RESTOCK / CONSUMPTION / WASTE / CORRECTION; logs StockMovement |
| M20.3 | Stock movement history | ✅ DONE | `GET /inventory/:id/movements` — paginated; type filter; createdBy user |
| M20.4 | Low stock alerts | ✅ DONE | `GET /inventory/low-stock` — items where currentStock ≤ minStockLevel; alert badge count |
| M20.5 | Supplier CRUD | ✅ DONE | `GET/POST/PATCH/DELETE /inventory/suppliers` — name, contactName, phone, email, address |
| M20.6 | Purchase orders | ✅ DONE | `POST /inventory/purchase-orders` — creates PO against supplier; line items with quantity + unitCost |
| M20.7 | PO receive | ✅ DONE | `PATCH /inventory/purchase-orders/:id/receive` — marks received; auto-increments stock via RESTOCK movement |
| M20.8 | Inventory valuation | ✅ DONE | `GET /inventory/valuation` — total stock value (currentStock × costPerUnit) per item + grand total |
| M20.9 | Waste tracking | ✅ DONE | `POST /inventory/:id/waste` — WASTE movement; reason field; deducts from stock |
| M20.10 | Dashboard frontend | ✅ DONE | `InventoryPage.tsx` — 4 tabs: Inventory (CRUD + adjust) / Suppliers / Purchase Orders / Low Stock alert list |

**Schema**: `InventoryItem`, `StockMovement`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem` models; `StockMovementType` enum
**New module**: `src/inventory/`

---

### M21 — CRM & Customer Loyalty ✅ FULL-STACK COMPLETE (2026-02-28)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M21.1 | Customer segments | ✅ DONE | Dynamic segments: VIP (GOLD/PLATINUM), At-Risk (no order 30+ days), New (joined last 7 days), Regular |
| M21.2 | Loyalty program config | ✅ DONE | `PATCH /crm/loyalty-config` — pointsPerCurrency, tierThresholds, pointExpiry; per-restaurant |
| M21.3 | Campaign management | ✅ DONE | `GET/POST/PATCH/DELETE /crm/campaigns` — name, type (EMAIL/SMS/PUSH), target segment, scheduledAt |
| M21.4 | Campaign send | ✅ DONE | `POST /crm/campaigns/:id/send` — iterates target customers, creates CustomerNotification per recipient |
| M21.5 | Customer lifetime value | ✅ DONE | `GET /crm/customers/:id/ltv` — totalOrders, totalRevenue, avgOrderValue, firstOrder, lastOrder |
| M21.6 | Bulk loyalty points | ✅ DONE | `POST /crm/loyalty/bulk-award` — awards points to segment or all customers |
| M21.7 | Churn risk scoring | ✅ DONE | `GET /crm/churn-risk` — days-since-last-order score; HIGH/MEDIUM/LOW risk buckets |
| M21.8 | CRM dashboard frontend | ✅ DONE | `CRMPage.tsx` — 4 tabs: Customers / Segments / Campaigns / Loyalty |

**New module**: `src/crm/`

---

### M22 — Staff & HR Management ✅ FULL-STACK COMPLETE (2026-03-01)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M22.1 | Staff profiles | ✅ DONE | Extended User with `StaffProfile` — dateOfBirth, address, emergencyContact, salary, bankAccount |
| M22.2 | Shift scheduling | ✅ DONE | `GET/POST/PATCH/DELETE /staff/shifts` — MANAGER+; assignedTo, startTime, endTime, role, notes |
| M22.3 | Attendance tracking | ✅ DONE | `POST /staff/attendance/clock-in` + `clock-out` — tracks clockInTime, clockOutTime, hoursWorked |
| M22.4 | Leave requests | ✅ DONE | `GET/POST /staff/leave-requests` — staff creates; MANAGER approves/rejects via `PATCH /:id/status` |
| M22.5 | Payroll summary | ✅ DONE | `GET /staff/payroll` — hoursWorked × hourlyRate per staff member; period filter |
| M22.6 | Performance metrics | ✅ DONE | `GET /staff/:id/performance` — orders processed, revenue generated, avg order value; date range |
| M22.7 | Role & permission management | ✅ DONE | Existing M1 RBAC extended; staff CRUD in dashboard Users section |
| M22.8 | Staff dashboard frontend | ✅ DONE | `StaffPage.tsx` in dashboard — staff list, shift calendar, attendance log, leave request management |

**Schema**: `StaffProfile`, `Shift`, `AttendanceRecord`, `LeaveRequest` models
**New module**: `src/users/` extended with HR sub-controllers

---

### M23 — Owner Mobile App ✅ COMPLETE (2026-03-02)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M23.1 | Expo Router scaffold | ✅ DONE | `mobile-owner/` — Expo 55, Expo Router, React Query, Zustand, expo-secure-store |
| M23.2 | Auth flow | ✅ DONE | Login screen → JWT stored in SecureStore; persistent auth via Zustand |
| M23.3 | Dashboard screen | ✅ DONE | KPI cards (revenue, orders, customers); pulls `/analytics/dashboard` |
| M23.4 | Orders screen | ✅ DONE | Live order list; accept/reject actions; pull-to-refresh |
| M23.5 | Menu screen | ✅ DONE | Category list → item list → availability toggle |
| M23.6 | Reports screen | ✅ DONE | Revenue chart (daily), top items, channel breakdown |
| M23.7 | Push notifications | ✅ DONE | `expo-notifications` + FCM token registration; backend `POST /restaurants/:id/push-tokens`; fires on NEW_ORDER |
| M23.8 | Settings screen | ✅ DONE | Restaurant profile view, logout |

**Stack**: Expo Router (file-based), TanStack Query v5, Zustand + expo-secure-store, React Native 0.83
**Directory**: `mobile-owner/`

---

## TIER 5: SCALE

### M24 — Multi-Location Management ✅ FULL-STACK COMPLETE (2026-03-03)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M24.1 | Multi-restaurant under one tenant | ✅ DONE | Existing schema already supports N restaurants per tenant; dashboard restaurant switcher added |
| M24.2 | Create branch | ✅ DONE | OWNER can create additional restaurants under same tenant via `POST /restaurants` |
| M24.3 | Cross-location analytics | ✅ DONE | Super Admin `/platform/revenue` already cross-tenant; per-tenant cross-restaurant analytics added |
| M24.4 | Shared menu templates | ✅ DONE | `POST /restaurants/:id/menu/copy-to/:targetId` — clones categories + items + modifier groups |
| M24.5 | Staff assignment per location | ✅ DONE | Users scoped to restaurantId; OWNER can assign staff to any branch |
| M24.6 | Location switcher (dashboard) | ✅ DONE | TopBar restaurant selector; switches `restaurantId` in Zustand store |
| M24.7 | Consolidated order view | ✅ DONE | `GET /orders?allLocations=true` for OWNER role — aggregates across all tenant restaurants |
| M24.8 | Frontend multi-location pages | ✅ DONE | `MultiLocationPage.tsx` — branch list, create branch dialog, per-branch KPIs, menu copy action |

**Schema**: No new models; uses existing multi-restaurant Tenant structure
**Modified**: `frontend-dashboard/src/router/index.tsx` — `/locations` route added

---

### M25 — White-Label Customer Mobile App ✅ COMPLETE (2026-03-04)

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| M25.1 | Expo scaffold (white-label) | ✅ DONE | `mobile-customer/` — `restaurantSlug` configured in `app.json extra`; no hardcoded restaurant |
| M25.2 | Auth flow | ✅ DONE | Register / Login via `/online/:slug/auth/*`; JWT stored in SecureStore |
| M25.3 | Menu browsing | ✅ DONE | Category tabs → item list → item detail with modifier selection (up to 3 nested levels) |
| M25.4 | Cart + checkout | ✅ DONE | Redis cart via `/online/:slug/cart/*`; cartToken persisted; add/update/remove items |
| M25.5 | Order placement | ✅ DONE | `POST /online/:slug/orders` — DELIVERY or TAKEAWAY; modifier support |
| M25.6 | Order tracking | ✅ DONE | Live status polling; statusHistory timeline |
| M25.7 | Account screen | ✅ DONE | Profile, order history, loyalty points, logout |
| M25.8 | Push notifications | ✅ DONE | expo-notifications; backend token registration; ORDER_STATUS_CHANGE trigger |

**Stack**: Expo Router, TanStack Query v5, Zustand + expo-secure-store, React Native 0.83
**API**: 24-hour customer JWTs; no refresh token
**Directory**: `mobile-customer/`

---

## SCHEMA ENHANCEMENTS (Post M25)

### Nested Modifiers — DoorDash-style 3-level nesting ✅ COMPLETE (2026-03-04)

| Change | Detail |
|--------|--------|
| Schema | `Modifier.parentModifierId` → `ModifierGroup` via `"ChildGroups"` relation (self-referential) |
| Backend | `createGroup` accepts `parentModifierId`; `listGroups` / `getGroup` recursively include up to 3 levels |
| Dashboard | `ModifierGroupCard` — recursive render + "Sub-options" button per modifier row |
| QR Ordering | `ItemModal.tsx` — inline child group expansion on modifier select |
| Mobile | `item/[itemId].tsx` — recursive `renderGroup()` with depth indent |
| POS | `ModifierModal.tsx` — inline child group expansion |
| Online ordering | Scaffolded |

### Per-Option `isRequired` Flag ✅ COMPLETE (2026-03-04)

| Change | Detail |
|--------|--------|
| Schema | `Modifier.isRequired Boolean @default(false)` — distinct from group-level `isRequired` |
| Backend DTO | `isRequired?` added to `CreateModifierDto`; `UpdateModifierDto` inherits via `PartialType` |
| Backend Service | `isRequired` persisted in `addModifier`, `createGroup` inline create, `updateModifier` |
| Dashboard types | `isRequired: boolean` on `Modifier`; `isRequired?: boolean` on `CreateModifierDto` |
| Dashboard UI | "Required" toggle in `ModifierDialog`; Lock icon + `bg-orange-50/60` tint on required rows in `ModifierGroupCard` |
| QR modal | Lazy `useState` seeds required IDs on mount; `toggleModifier` guard; Lock icon replaces radio/checkbox |
| Mobile | `useEffect` seeds required IDs when item loads; `toggleModifier` guard; 🔒 emoji on required rows |
| POS modal | Same seed / guard / Lock icon pattern |

### Removed `displayLabel` from `ModifierGroup` ✅ COMPLETE (2026-03-04)

Removed from: schema, backend DTO/service, dashboard types/UI, QR types/modal, mobile types/screen, POS modal. Zero references remain.

---

## Progress Summary (Updated 2026-03-04)

| Tier | Module | Status | Completion |
|------|--------|--------|-----------|
| T0 | M0 Foundation | ✅ COMPLETE | 26/27 (M0.4.3 staging deferred) |
| T1 | M1 Auth & Users | ✅ COMPLETE | 10/10 |
| T1 | M2 Restaurant Config | ✅ COMPLETE | 10/10 |
| T1 | M3 Menu Management | ✅ COMPLETE | 10/10 |
| T1 | M4 Order Engine | ✅ COMPLETE | 10/10 |
| T1 | M5 POS System | ✅ COMPLETE | 10/10 |
| T1 | M6 KDS | ✅ COMPLETE | 10/10 |
| T1 | M7 Payments | ✅ COMPLETE | 10/10 |
| T1 | M8 Customers | ✅ COMPLETE | 10/10 |
| T1 | M9 Analytics | ✅ COMPLETE | 10/10 |
| T1 | M10 Super Admin | ✅ COMPLETE | 13/13 |
| T1 | M11 Notifications | ✅ COMPLETE | 13/13 |
| T2 | M12 QR Table Ordering | ✅ COMPLETE | 12/12 |
| T2 | M13 Online Ordering | ✅ COMPLETE | 12/12 |
| T2 | M14 Online Ordering Payments | ✅ COMPLETE | 10/10 |
| T2 | M15 Enhanced Customer Experience | ✅ COMPLETE | 10/10 |
| T2 | M16 Enhanced Order Management | ✅ COMPLETE | 6/7 (M16.5 frontend-only, deferred) |
| T3 | M17 Aggregator Integration Hub | ✅ COMPLETE | 14/17 (M17.8/M17.10UI frontend deferred) |
| T3 | M18 Delivery Management | ✅ FULL-STACK COMPLETE | 10/10 + DeliveryPage 4-tab |
| T3 | M19 Reporting & Analytics | ✅ FULL-STACK COMPLETE | 9/9 + ReportsPage 4-tab |
| T4 | M20 Inventory & Stock | ✅ FULL-STACK COMPLETE | 10/10 + InventoryPage 4-tab |
| T4 | M21 CRM & Loyalty | ✅ FULL-STACK COMPLETE | 8/8 + CRMPage 4-tab |
| T4 | M22 Staff & HR | ✅ FULL-STACK COMPLETE | 8/8 + StaffPage |
| T4 | M23 Owner Mobile App | ✅ COMPLETE | 8/8 screens + push notifications |
| T5 | M24 Multi-Location | ✅ FULL-STACK COMPLETE | 8/8 + MultiLocationPage |
| T5 | M25 Customer Mobile App | ✅ COMPLETE | 8/8 screens + push notifications |
| T5 | M26 Self-Service Kiosk | ⏳ NEXT | `backend/src/kiosk/` folder exists, empty |
| T5–6 | M27–M43 | ⏳ PLANNED | Scale & Ecosystem tier |

**Total completed: M0–M25 (26 modules)**
**Next: M26 Self-Service Kiosk**

---

## SUPERADMIN EXTENDED FEATURES — Tracking Board

> Gap analysis from RestroCloud_Final_Product_Documentation.md Section 4.2
> Baseline: M10 complete (13 endpoints). Building extended governance features.

---

### SA-A — Tenant Management Extended Actions ⏳ IN PROGRESS

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-A.1 | Apply credit/discount to tenant | ✅ DONE | `PATCH /super-admin/tenants/:id/credit` — adds `creditBalance` to Tenant |
| SA-A.2 | Extend trial period | ✅ DONE | `PATCH /super-admin/tenants/:id/extend-trial` — updates `trialEndsAt` |
| SA-A.3 | Terminate account (soft) | ✅ DONE | `PATCH /super-admin/tenants/:id/terminate` — sets `terminatedAt`, cascade deactivate |
| SA-A.4 | Flag / unflag for review | ✅ DONE | `PATCH /super-admin/tenants/:id/flag` + `unflag` — `flaggedForReview` + `flagReason` |
| SA-A.5 | Internal notes CRUD | ✅ DONE | `POST/GET/DELETE /super-admin/tenants/:id/notes` — `TenantNote` model |
| SA-A.6 | Assign account manager | ✅ DONE | `PATCH /super-admin/tenants/:id/assign-manager` — links super admin to tenant |
| SA-A.7 | Frontend — Tenant detail drawer extended | ✅ DONE | Credit input, trial extend, terminate, flag toggle, notes tab, manager assign |

**Schema additions**: `Tenant.creditBalance`, `Tenant.flaggedForReview`, `Tenant.flagReason`, `Tenant.terminatedAt`, `Tenant.accountManagerId`; new `TenantNote` model

---

### SA-B — Financial Dashboard ⏳ PENDING

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-B.1 | MRR / ARR metrics | ✅ DONE | Platform subscription revenue breakdown |
| SA-B.2 | Revenue by plan tier | ✅ DONE | Count + revenue per STARTER/GROWTH/ENTERPRISE |
| SA-B.3 | Outstanding invoices view | ✅ DONE | Tenants with overdue/trial-expired status |
| SA-B.4 | Financial dashboard page (frontend) | ✅ DONE | New `/finance` route in superadmin app |

---

### SA-C — Feature Flags ✅ COMPLETE

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-C.1 | Global feature flag CRUD | ✅ | Redis `feature:flag:{key}` + `feature:flag:keys` set; create/toggle/delete |
| SA-C.2 | Per-tenant feature overrides | ✅ | Redis `feature:tenant:{id}:{key}` + `feature:tenant:{id}:keys`; no schema change needed |
| SA-C.3 | Feature flag API endpoints | ✅ | `GET/POST/DELETE /super-admin/feature-flags`; `GET/POST/DELETE /super-admin/feature-flags/tenant/:id` |
| SA-C.4 | Feature flags page (frontend) | ✅ | 2-tab UI: Global Flags (toggle/add/delete) + Tenant Overrides (search tenant, add/toggle/remove) |

---

### SA-D — Support Ticket System ✅ COMPLETE

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-D.1 | Ticket model (schema) | ✅ | `SupportTicket` + `TicketMessage` + `Announcement` models; `TicketStatus`/`TicketPriority` enums; `prisma db push` |
| SA-D.2 | Create / list / get tickets | ✅ | `POST/GET /super-admin/tickets`, `GET /super-admin/tickets/stats`, `GET /super-admin/tickets/:id` |
| SA-D.3 | Reply to ticket | ✅ | `POST /super-admin/tickets/:id/messages`; auto-advances OPEN→IN_PROGRESS on first staff reply |
| SA-D.4 | Assign / resolve / close ticket | ✅ | `PATCH /super-admin/tickets/:id`; sets `resolvedAt`/`closedAt` timestamps; blocks reply on CLOSED |
| SA-D.5 | System-wide announcement | ✅ | `GET/POST/DELETE /super-admin/announcements`; logged in audit trail |
| SA-D.6 | Support tickets page (frontend) | ✅ | `SupportPage.tsx` — Tickets tab (stats cards, list, slide-in detail with reply) + Announcements tab |

---

### SA-E — Super Admin Role Hierarchy ✅ COMPLETE

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-E.1 | Extend UserRole enum | ✅ | Added: PLATFORM_OWNER, SUPER_ADMIN, FINANCE_ADMIN, SUPPORT_MANAGER, SUPPORT_AGENT, ENGINEERING_ADMIN; `prisma db push` |
| SA-E.2 | Role-scoped guards | ✅ | `RolesGuard` updated: SUPER_ADMIN/PLATFORM_OWNER bypass all; Finance endpoints scope FINANCE_ADMIN; Feature flags scope ENGINEERING_ADMIN; Tickets scope SUPPORT_MANAGER/AGENT |
| SA-E.3 | Role management UI (frontend) | ✅ | `UsersPage.tsx` rewritten: role badge column (color-coded), role selector + scope description in create dialog |

---

### Progress Summary — Superadmin Extended

| Group | Features | Done | Status |
|-------|----------|------|--------|
| SA-A Tenant Actions | 7 | 7 | ✅ Complete |
| SA-B Financial | 4 | 4 | ✅ Complete |
| SA-C Feature Flags | 4 | 4 | ✅ Complete |
| SA-D Support Tickets | 6 | 6 | ✅ Complete |
| SA-E Role Hierarchy | 3 | 3 | ✅ Complete |
| **Total** | **24** | **24** | ✅ All Complete |

---

# Superadmin — Phase 2 (Product Doc Gaps)

## Tracking Board

| Group | Features | Done | Status |
|-------|----------|------|--------|
| SA-F Cross-tenant Users (B) | 5 | 5 | ✅ Complete |
| SA-G Subscription & Billing (D) | 5 | 5 | ✅ Complete |
| SA-H Enhanced Dashboard (E) | 4 | 4 | ✅ Complete |
| SA-I Email Broadcasts (F/G) | 3 | 3 | ✅ Complete |
| SA-J Analytics Intelligence (H) | 4 | 4 | ✅ Complete |
| SA-K System Administration (I) | 4 | 4 | ✅ Complete |
| SA-L Marketing & Growth (J) | 4 | 4 | ✅ Complete |
| **Total** | **29** | **15** | |

---

### SA-F — Cross-tenant User Management ✅ COMPLETE
_Product doc §B — search all users, view details, unlock/reset_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-F.1 | List/search all platform users | ✅ | `GET /super-admin/platform-users` — cross-tenant, filter by name/email/isActive, paginated |
| SA-F.2 | User detail view | ✅ | `GET /super-admin/platform-users/:userId` — profile + tenant + restaurant + last login |
| SA-F.3 | Reset user password | ✅ | `POST /super-admin/platform-users/:userId/reset-password` — generates temp password, returns it, logs audit |
| SA-F.4 | Unlock / reactivate user | ✅ | `PATCH /super-admin/platform-users/:userId/unlock` — sets isActive=true, clears Redis cache |
| SA-F.5 | Frontend — Platform Users page | ✅ | `PlatformUsersPage.tsx` — search+filter table, slide-in detail drawer, reset password + unlock actions |

---

### SA-G — Subscription & Billing ✅ COMPLETE
_Product doc §D — subscriptions list, coupons, bulk changes, trial tracking_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-G.1 | Subscription list view | ✅ | `GET /super-admin/billing/subscriptions` — all tenants with plan/status/billing cycle |
| SA-G.2 | Coupon/promo code CRUD | ✅ | `POST/GET/PATCH /super-admin/billing/coupons` — code, discount%, max uses, expiry |
| SA-G.3 | Apply coupon to tenant | ✅ | `POST /super-admin/billing/coupons/:id/apply/:tenantId` |
| SA-G.4 | Trial conversion metrics | ✅ | `GET /super-admin/billing/conversions` — trial→paid counts, conversion %, avg days to convert |
| SA-G.5 | Frontend — SA Billing page | ✅ | `/billing` route in superadmin — Subscriptions tab + Coupons tab + Conversions tab |

---

### SaaS Billing Engine ✅ COMPLETE (2026-03-08)
_Self-service subscription management from restaurant dashboard_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| B.1 | Schema: TenantSubscription + Invoice models | ✅ | BillingCycle/SubStatus/InvoiceStatus enums + `prisma db push` applied |
| B.2 | `GET /billing` — self-service subscription view | ✅ | Returns plan, status, period, price, creditBalance, planPrices map |
| B.3 | `POST /billing/upgrade` — plan change | ✅ | OWNER only; creates PAID invoice; updates Tenant.plan atomically |
| B.4 | `POST /billing/cancel` — cancel at period end | ✅ | Sets cancelAtPeriodEnd=true; cron picks up at period end |
| B.5 | `POST /billing/reactivate` — undo cancellation | ✅ | Clears cancelAtPeriodEnd |
| B.6 | `POST /billing/pause` + resume | ✅ | PAUSED status; resume recalculates period end |
| B.7 | `GET /billing/invoices` — invoice history | ✅ | Paginated; shows plan, amount, status, billing cycle |
| B.8 | Cron: trial expiry → PAST_DUE | ✅ | `@Cron(EVERY_HOUR)` — emails owner on expiry |
| B.9 | Cron: 3-day trial expiry warning email | ✅ | `@Cron('0 9 * * *')` daily |
| B.10 | Frontend — Restaurant dashboard `/billing` page | ✅ | CurrentPlanCard + PlanPicker modal + InvoiceHistory table |
| B.11 | Sidebar: Billing link in Admin section | ✅ | CreditCard icon, `/billing` route wired |

---

### SA-H — Enhanced Dashboard ⏳ PENDING
_User item #3 — churn rate, trial conversion %, active users now on KPI cards_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-H.1 | Churn rate metric | ⏳ | Tenants terminated/suspended this month vs. last month |
| SA-H.2 | Trial conversion % | ⏳ | Trials that upgraded to paid plan this month |
| SA-H.3 | Active users now | ⏳ | Redis-backed active session count (users with valid JWT in last 15 min) |
| SA-H.4 | Enhanced DashboardPage KPIs | ⏳ | Add 3 new stat cards + sparkline trend to existing DashboardPage |

---

### SA-I — Email Broadcasts ✅ COMPLETE
_User item #4 — extends existing Announcements to send as emails to tenant owners_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-I.1 | Email broadcast backend | ✅ | `POST /super-admin/broadcasts` — send HTML email to all/segment tenant owners via EmailService |
| SA-I.2 | Broadcast history | ✅ | `GET /super-admin/broadcasts` — list sent broadcasts with recipient count + status |
| SA-I.3 | Frontend — Broadcasts tab | ✅ | Add Broadcasts tab to SupportPage — compose form (segment selector, subject, body preview), history table |

---

### SA-J — Analytics Intelligence ✅ COMPLETE
_Product doc §H — cohort analysis, feature adoption, churn prediction signals_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-J.1 | Cohort retention table | ✅ | `GET /super-admin/analytics/cohorts` — sign-up month cohort × active months heatmap |
| SA-J.2 | Feature adoption tracking | ✅ | `GET /super-admin/analytics/feature-adoption` — % of tenants using each module (orders/delivery/CRM/etc.) |
| SA-J.3 | At-risk tenant signals | ✅ | `GET /super-admin/analytics/at-risk` — tenants with declining order volume, no login >14d, trial expiring |
| SA-J.4 | Frontend — Analytics Intelligence page | ✅ | New `/intelligence` route — cohort heatmap, adoption bar chart, at-risk list |

---

### SA-K — System Administration ✅ COMPLETE
_Product doc §I — error logs, DB health, GDPR deletion_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-K.1 | Error log viewer | ✅ | `GET /super-admin/system/errors` — Redis-backed recent error log (last 200 errors, APP_FILTER) |
| SA-K.2 | DB & Redis health detail | ✅ | `GET /super-admin/system/health-detail` — table sizes + Redis memory/hit-rate/uptime |
| SA-K.3 | GDPR data deletion | ✅ | `POST /super-admin/system/gdpr/delete-user` — anonymise customer PII, delete saved payments/reviews |
| SA-K.4 | Frontend — System Admin page | ✅ | New `/system` route — Error Log tab + DB/Redis Health tab + GDPR tab |

---

### SA-L — Marketing & Growth ✅ COMPLETE
_Product doc §J — email campaigns, referral codes, in-app banners_

| Sub | Feature | Status | Notes |
|-----|---------|--------|-------|
| SA-L.1 | Referral code management | ✅ | `POST/GET/PATCH /super-admin/marketing/referrals` — code, discount, credit%, apply to tenant |
| SA-L.2 | In-app banner management | ✅ | `POST/GET/PATCH/DELETE /super-admin/marketing/banners` — title, body, CTA, plan target, toggle/delete |
| SA-L.3 | Campaign stats | ✅ | `GET /super-admin/marketing/stats` — referral usages, broadcast recipients, coupon redemptions, top codes |
| SA-L.4 | Frontend — Marketing page | ✅ | New `/marketing` route — Campaign Stats tab + Referral Codes tab + In-App Banners tab |

---

## CUSTOMER ORDERING FRONTEND — Gap Analysis (2026-03-06)

> Analysis of `frontend-ordering/` (Next.js 15 App Router) against what a production restaurant ordering website needs.

### What's Already Built

| Area | Component | Status | Notes |
|------|-----------|--------|-------|
| Discovery | Homepage — restaurant list with search + city filter | ✅ DONE | `app/page.tsx` — skeleton loading, load-more pagination |
| Discovery | RestaurantCard — image, name, delivery info, cuisine tags | ✅ DONE | `components/online/RestaurantCard.tsx` |
| Restaurant | Restaurant page — SSR slug lookup | ✅ DONE | `app/[restaurantSlug]/page.tsx` — server-side fetch |
| Restaurant | RestaurantHero — banner, logo, name, delivery badge | ✅ DONE | Scrolled/minimal mode |
| Menu | Menu browsing — categories + items with search | ✅ DONE | `MenuView.tsx` — category sidebar nav, search filter |
| Menu | Item modal — modifiers, quantity, notes, add to cart | ✅ DONE | Reused `qr/ItemModal.tsx` |
| Cart | Cart drawer — items list, qty controls, subtotal | ✅ DONE | `CartDrawer.tsx` — slide-in panel |
| Cart | Floating cart bar — item count + "View Cart" CTA | ✅ DONE | Fixed bottom bar when cart has items |
| Checkout | Checkout view — order type selector (delivery/takeaway), address, notes, tip | ✅ DONE | `CheckoutView.tsx` |
| Auth | Auth modal — register / login tabs | ✅ DONE | `AuthModal.tsx` — customer JWT |
| Auth | Auth state — sign in/out in header | ✅ DONE | `Hi, {name}` greeting + sign out button |
| Orders | Order tracker — status timeline, item list, "Order Again" | ✅ DONE | `OrderTracker.tsx` |
| QR Flow | QR table ordering — full guest flow | ✅ DONE | `app/table/[restaurantId]/[tableId]/page.tsx` + `QrShell.tsx` |
| QR Flow | QR cart, place order, track, bill request, receipt, feedback | ✅ DONE | Full 12-component flow |
| State | Cart store — cartToken, items, counts (localStorage-persisted) | ✅ DONE | `online-cart.store.ts` Zustand |
| State | Customer store — JWT, customer profile (localStorage-persisted) | ✅ DONE | `online-customer.store.ts` Zustand |
| API | All online ordering API calls (menu, cart, order, auth) | ✅ DONE | `lib/online.api.ts` |
| Bug fix | `getMenu()` extracts `.categories` from `{ restaurant, categories }` response | ✅ FIXED | 2026-03-06 |

### What's Missing (Gap Analysis)

The backend has ALL the data — these are purely frontend pages/components that haven't been built yet:

#### HIGH PRIORITY — Core User Journeys

| # | Feature | Why Needed | Backend Endpoint |
|---|---------|-----------|-----------------|
| FO-1 | **Customer Account / Profile page** | After login, user has nowhere to go — no `/account` page | `GET /online/:slug/auth/me`, `PATCH /online/:slug/auth/me` |
| FO-2 | **Order History page** | Users can't see past orders — kills retention + reorder intent | `GET /online/:slug/my/orders` |
| FO-3 | **Single order detail / receipt page** | No way to view a past order's itemised receipt | `GET /online/:slug/my/orders/:id/receipt` |
| FO-4 | **Loyalty points dashboard** | Loyalty earns/redeems silently — users never see their balance | `GET /online/:slug/my/loyalty` |
| FO-5 | **Reorder button** | "Order Again" in tracker works once; no history = no reorder later | `POST /online/:slug/my/reorder/:orderId` |
| FO-6 | **Saved addresses UI** | Checkout always asks for new address — friction killer for repeat orders | `GET/POST/PATCH/DELETE /online/:slug/my/addresses` |
| FO-7 | **Payment method selector at checkout** | Saved payment methods exist in backend but checkout UI ignores them | `GET /online/:slug/my/payment-methods` |

#### MEDIUM PRIORITY — Conversion & Trust

| # | Feature | Why Needed | Backend Endpoint |
|---|---------|-----------|-----------------|
| FO-8 | **Restaurant reviews section** | Social proof — approved reviews displayed on restaurant page | `GET /online/:slug/reviews` |
| FO-9 | **Submit a review** | Post-delivery review flow — drives engagement | `POST /online/:slug/reviews` (customer JWT) |
| FO-10 | **Loyalty points at checkout** | Redeem points UI missing — `redeemPoints` field in PlaceOrderDto is wired but not exposed | `POST /online/:slug/orders` (`redeemPoints` param) |
| FO-11 | **Payment gateway flow** | COD works, but Stripe/bKash/SSLCommerz redirect UIs don't exist | `POST /online/:slug/orders/:id/pay`, webhook polling |
| FO-12 | **Order tracking live poll** | OrderTracker exists but no periodic status refresh — user must reload | `GET /online/:slug/orders/:id` |
| FO-13 | **Restaurant open/closed badge** | No indicator if restaurant is currently open — users don't know | `GET /online/:slug` returns `operatingHours` |
| FO-14 | **Customer notifications list** | Backend creates notifications on status change; no UI to see them | `GET /online/:slug/my/notifications` |

#### LOW PRIORITY — Polish

| # | Feature | Why Needed |
|---|---------|-----------|
| FO-15 | **Empty cart state** | Cart drawer shows nothing useful when empty |
| FO-16 | **Allergen / dietary tags on items** | `allergens[]` + `dietaryTags[]` exist on Item model; not shown in menu |
| FO-17 | **Estimated delivery time display** | `estimatedDeliveryMin` exists in restaurant data — show it on checkout |
| FO-18 | **Minimum order warning** | `minimumOrderAmount` exists — should block checkout below threshold |
| FO-19 | **Search results highlighting** | Search filters items but doesn't highlight the matching text |
| FO-20 | **PWA / Add to Home Screen** | `layout.tsx` has theme-color but no manifest.json + service worker |

### Build Status (2026-03-06)

| # | Feature | Status | Component |
|---|---------|--------|-----------|
| FO-1 | Customer Account / Profile page | ✅ DONE | `AccountView.tsx` — Profile tab |
| FO-2 | Order History page | ✅ DONE | `AccountView.tsx` — Orders tab |
| FO-3 | Single order detail / receipt page | ✅ DONE | Receipt modal inside Orders tab |
| FO-4 | Loyalty points dashboard | ✅ DONE | `AccountView.tsx` — Loyalty tab (balance, tier, progress, history) |
| FO-5 | Reorder button | ✅ DONE | "Reorder" in Orders tab → `POST /my/reorder/:id` → fresh cart |
| FO-6 | Saved addresses UI | ✅ DONE | `AccountView.tsx` — Addresses tab (CRUD + default) |
| FO-7 | Payment method selector at checkout | ✅ DONE | `CheckoutView.tsx` — COD/bKash/SSLCommerz/Stripe radio picker |
| FO-8 | Restaurant reviews section | ✅ DONE | `ReviewsSection.tsx` — star ratings, avg, pagination at bottom of menu |
| FO-9 | Submit a review | ✅ DONE | `ReviewsSection.tsx` — star selector + comment form (JWT required) |
| FO-10 | Loyalty points redeem at checkout | ✅ DONE | `CheckoutView.tsx` — toggle + slider to choose points to redeem |
| FO-11 | Payment gateway flow | ✅ DONE | `PaymentView.tsx` — gateway session display + mock confirm flow |
| FO-12 | Order tracking live poll | ✅ ALREADY DONE | `OrderTracker.tsx` had `setInterval(15000)` already |
| FO-13 | Restaurant open/closed badge | ✅ ALREADY DONE | `RestaurantHero.tsx` had open/closed badge already |
| FO-14 | Customer notifications list | ✅ DONE | `NotificationsDrawer.tsx` — slide-in panel with bell icon + unread badge |

**Architecture decisions:**
- AccountView is a view state in OnlineShell (same SPA, no new URL) — consistent with checkout/tracking pattern
- `'account'` and `'payment'` added to `OnlineView` union type
- Notification bell in sticky header, shows unread badge, fetched on login
- Reorder: calls `/my/reorder/:id` → gets cartToken → `getCart()` → updates store → `setView('menu')`
- Payment gateway: after placeOrder, if non-COD → `initiatePayment()` → `setView('payment')` → PaymentView → on confirm → `setView('tracking')`
- CheckoutView now fetches loyalty + saved addresses in parallel when logged in
- `redeemPoints` wired through placeOrder body to backend
