# RestroCloud — Module Breakdown for Development
## Every Module → Sub-Components → Build Order

**Date:** February 2026
**Purpose:** Break the entire RestroCloud platform into the smallest testable development units and define the exact build sequence.

---

# BUILD ORDER SUMMARY

Before diving into sub-components, here is the definitive build sequence. Modules are grouped into 7 tiers. Each tier MUST be completed before the next tier begins, because later tiers depend on earlier ones.

```
TIER 0: FOUNDATION (Weeks 1–4) — Everything else depends on this
  └── M0: Platform Foundation

TIER 1: MVP CORE (Weeks 5–12) — Minimum to onboard a single restaurant
  ├── M1: Authentication & User Management
  ├── M2: Restaurant Profile & Configuration
  ├── M3: Menu Management
  ├── M4: Order Engine (Core)
  ├── M5: Point of Sale (POS)
  ├── M6: Kitchen Display System (KDS)
  ├── M7: Table Management (Basic)
  ├── M8: Payment Processing (Basic)
  ├── M9: Restaurant Admin Dashboard
  ├── M10: Super Admin Panel (Basic)
  └── M11: Notification Service (Basic)

TIER 2: DIGITAL CHANNELS (Weeks 13–20) — Revenue generation begins
  ├── M12: QR Table Ordering
  ├── M13: Online Ordering Website
  ├── M14: Payment Gateway Integration (Online)
  ├── M15: Customer Accounts & Database
  └── M16: Order Management (Enhanced)

TIER 3: AGGREGATORS + DELIVERY (Weeks 21–28) — Hero differentiator
  ├── M17: Aggregator Integration Hub
  ├── M18: Delivery Management
  └── M19: Reporting & Analytics (Basic)

TIER 4: BACK-OFFICE (Weeks 29–36) — Cost reduction & retention features
  ├── M20: Inventory & Stock Management
  ├── M21: CRM & Customer Loyalty
  ├── M22: Staff & HR Management
  └── M23: Owner Mobile App

TIER 5: SCALE (Weeks 37–48) — Multi-location & advanced features
  ├── M24: Multi-Location Management
  ├── M25: White-Label Mobile App (Customer)
  ├── M26: Self-Service Kiosk
  ├── M27: Advanced Analytics & AI
  ├── M28: Accounting Integration
  ├── M29: Table Management (Advanced)
  ├── M30: Digital Menu Display
  └── M31: Super Admin Panel (Full)

TIER 6: ECOSYSTEM (Weeks 49–64) — Platform plays & growth
  ├── M32: Drive-Through Module
  ├── M33: WhatsApp & Chat Ordering
  ├── M34: Catering & Bulk Orders
  ├── M35: Gift Card System
  ├── M36: Subscription & Meal Plans
  ├── M37: Open API & Marketplace
  ├── M38: Multi-Brand / Cloud Kitchen
  ├── M39: Food Safety & Compliance
  ├── M40: Advanced Delivery (Driver App + Live Tracking)
  ├── M41: Voice Ordering (AI)
  ├── M42: Social Media & Google Ordering
  └── M43: Reservation + Pre-Order (Advanced)
```

---

# DEPENDENCY MAP

Understanding which modules depend on which is critical. Build the dependency first.

```
M0 (Foundation) ─────────────────────────► EVERYTHING depends on this

M1 (Auth) ───────────────────────────────► M2, M5, M9, M10, M12, M13, M15
M2 (Restaurant Profile) ─────────────────► M3, M7, M5, M13
M3 (Menu) ───────────────────────────────► M4, M5, M6, M12, M13, M17, M26
M4 (Order Engine) ───────────────────────► M5, M6, M8, M12, M13, M16, M17, M18
M5 (POS) ────────────────────────────────► M7, M8, M16
M8 (Payment Basic) ──────────────────────► M14, M35
M11 (Notifications) ─────────────────────► M12, M13, M16, M17, M18, M21
M15 (Customer Accounts) ─────────────────► M21, M25, M36
M3 + M4 + M14 ───────────────────────────► M12 (QR), M13 (Website)
M4 + M11 + M14 ──────────────────────────► M17 (Aggregator Hub)
M3 + M20 (Inventory) ────────────────────► M27 (Analytics), M34 (Catering)
M4 + M18 (Delivery) ─────────────────────► M40 (Advanced Delivery)
M2 + M24 (Multi-Location) ───────────────► M38 (Multi-Brand)
```

---

# COMPLETE MODULE BREAKDOWN

Each module below is broken into the smallest testable sub-components. Each sub-component can be developed, unit-tested, and deployed independently.

Format for each sub-component:
- **ID** — unique identifier for task tracking
- **Name** — what it does
- **Type** — Backend API, Frontend UI, Database, Service, or Integration
- **Test** — how you verify it works

---

## M0: PLATFORM FOUNDATION
**Phase:** 0 | **Weeks:** 1–4 | **Dependencies:** None
**Priority:** 🔴 CRITICAL — nothing works without this

### M0.1 — Database Architecture
| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M0.1.1 | PostgreSQL setup with multi-tenant schema (row-level isolation via `tenant_id`) | Database | Can create 2 separate restaurant tenants, data is isolated |
| M0.1.2 | Core entity schemas: Restaurant, User, Role, Permission | Database | Migrations run successfully, relationships enforced |
| M0.1.3 | Menu entity schemas: Category, Item, Modifier, ModifierGroup, Combo | Database | Can create menu items with nested modifiers |
| M0.1.4 | Order entity schemas: Order, OrderItem, OrderModifier, OrderStatus | Database | Can create order with multiple items and modifiers |
| M0.1.5 | Payment entity schemas: Payment, Refund, Transaction | Database | Can record payments linked to orders |
| M0.1.6 | Table entity schemas: Table, FloorSection, TableSession | Database | Can create tables assigned to sections |
| M0.1.7 | Customer entity schema: Customer, Address, LoyaltyAccount | Database | Can create customer with multiple addresses |
| M0.1.8 | Redis setup for caching, sessions, and real-time pub/sub | Infrastructure | Redis connects, can set/get keys, pub/sub works |
| M0.1.9 | Database seeding script with sample restaurant data | Database | Seed runs, creates demo restaurant with menu, tables, staff |

### M0.2 — Backend Framework
| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M0.2.1 | NestJS project scaffold with TypeScript | Backend | Project compiles, health endpoint returns 200 |
| M0.2.2 | API module structure (one module per service) | Backend | All module folders created with controller + service + dto pattern |
| M0.2.3 | OpenAPI/Swagger auto-documentation setup | Backend | /api/docs serves interactive API documentation |
| M0.2.4 | Global error handling and response formatting | Backend | Errors return consistent JSON format with codes |
| M0.2.5 | Request validation using class-validator DTOs | Backend | Invalid request body returns 400 with field-level errors |
| M0.2.6 | Logging middleware (structured JSON logs) | Backend | API calls produce structured logs with request ID |
| M0.2.7 | Rate limiting middleware | Backend | Exceeding limit returns 429 |

### M0.3 — Authentication System
| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M0.3.1 | JWT token generation (access + refresh tokens) | Backend | Login returns access token (15min) + refresh token (7d) |
| M0.3.2 | Token refresh endpoint | Backend | Expired access token + valid refresh token returns new access token |
| M0.3.3 | Role-Based Access Control (RBAC) middleware | Backend | Request with `waiter` role cannot access `owner`-only endpoints |
| M0.3.4 | Tenant isolation middleware (every request scoped to tenant_id) | Backend | Restaurant A cannot read Restaurant B data via API |
| M0.3.5 | Password hashing (bcrypt) | Backend | Passwords stored as hashes, login verifies correctly |

### M0.4 — Infrastructure & CI/CD
| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M0.4.1 | Docker containerization (backend, database, Redis) | Infrastructure | `docker-compose up` starts all services |
| M0.4.2 | CI pipeline (GitHub Actions): lint → test → build | Infrastructure | PR triggers pipeline, blocks merge on failure |
| M0.4.3 | Staging environment deployment | Infrastructure | Staging URL serves the API |
| M0.4.4 | Environment configuration management (.env, secrets) | Infrastructure | Different configs load for dev, staging, production |
| M0.4.5 | Database migration tooling (automatic up/down) | Infrastructure | `migrate:run` applies all pending migrations |

### M0.5 — Real-Time Communication
| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M0.5.1 | WebSocket server (Socket.io) setup | Backend | Client can connect and receive events |
| M0.5.2 | Room-based event broadcasting (per restaurant) | Backend | Event in Restaurant A is not received by Restaurant B |
| M0.5.3 | Event types definition (new_order, order_status_change, item_out_of_stock) | Backend | Each event type carries correct payload schema |

---

## M1: AUTHENTICATION & USER MANAGEMENT
**Phase:** 1 | **Dependencies:** M0
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M1.1 | Restaurant owner registration (email + password) | Backend + UI | Owner can register, receives verification email |
| M1.2 | Email verification flow | Backend | Clicking link verifies account, can now login |
| M1.3 | Login (email/password) | Backend + UI | Valid credentials return tokens, invalid returns 401 |
| M1.4 | Phone number login (OTP via SMS) | Backend | OTP sent via SMS, valid OTP returns tokens |
| M1.5 | Staff user creation by owner/manager | Backend + UI | Owner creates waiter account with waiter role |
| M1.6 | Role management: define permissions per role | Backend + UI | Cashier role has POS access but not reports access |
| M1.7 | Staff PIN login (quick login for POS terminals) | Backend + UI | 4-digit PIN logs staff into POS without full email/password |
| M1.8 | Session management (active sessions, force logout) | Backend | Owner can see active sessions and revoke any device |
| M1.9 | Password reset flow (email link) | Backend + UI | Reset link sends email, clicking it allows password change |
| M1.10 | Two-factor authentication (TOTP) for owner/manager | Backend + UI | After enabling 2FA, login requires code from authenticator app |

---

## M2: RESTAURANT PROFILE & CONFIGURATION
**Phase:** 1 | **Dependencies:** M0, M1
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M2.1 | Restaurant profile CRUD (name, address, phone, logo, description) | Backend + UI | Can create restaurant with all fields, update, view |
| M2.2 | Operating hours configuration (per day, with holiday overrides) | Backend + UI | Monday 9am–10pm, closed Sunday, Christmas closed |
| M2.3 | Tax configuration (VAT/GST rate, inclusive vs exclusive) | Backend | Tax correctly calculated on a $10 item at 15% |
| M2.4 | Currency setting (auto-detected from country, manual override) | Backend | Restaurant in BD shows BDT, restaurant in US shows USD |
| M2.5 | Service charge configuration (%, fixed, or none) | Backend | 10% service charge added to subtotal |
| M2.6 | Tip configuration (suggested %, custom entry) | Backend + UI | Checkout shows 10%, 15%, 20%, custom tip options |
| M2.7 | Receipt configuration (header text, footer text, logo) | Backend + UI | Printed receipt shows custom header and footer |
| M2.8 | Order type configuration (enable/disable dine-in, takeaway, delivery) | Backend + UI | Restaurant with only takeaway doesn't show dine-in option |
| M2.9 | Auto-accept vs manual-accept toggle per channel | Backend + UI | QR orders set to auto-accept bypass pending state |
| M2.10 | Restaurant timezone and locale settings | Backend | Order timestamps show in restaurant's local timezone |

---

## M3: MENU MANAGEMENT
**Phase:** 1 | **Dependencies:** M0, M2
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M3.1 | Category CRUD (name, display order, image, active/inactive) | Backend + UI | Create "Burgers" category, reorder to position 1 |
| M3.2 | Menu item CRUD (name, description, price, photo, category) | Backend + UI | Create "Cheeseburger" at $9.99 in Burgers category |
| M3.3 | Item photo upload with auto-optimization (resize, compress, CDN) | Backend | Upload 5MB photo, stored as optimized 200KB on CDN |
| M3.4 | Modifier group CRUD (name, min/max selection, required/optional) | Backend + UI | "Size" group: required, min 1, max 1 |
| M3.5 | Modifier item CRUD (name, price adjustment, linked to group) | Backend + UI | "Large" modifier adds $2.00 to base price |
| M3.6 | Item availability toggle (in stock / out of stock / hidden) | Backend + UI | Marking "out of stock" hides from all ordering channels instantly |
| M3.7 | Item tags: allergens (gluten, nuts, dairy, etc.) | Backend + UI | Item shows "Contains: Gluten, Dairy" badge |
| M3.8 | Item tags: dietary (vegan, vegetarian, halal, kosher) | Backend + UI | Filter menu by "Vegan" shows only vegan items |
| M3.9 | Item variants (same item, different sizes/configs at different prices) | Backend + UI | Small Pizza $8, Medium $12, Large $16 as one item card |
| M3.10 | Combo / Meal deal builder (group items at discounted price) | Backend + UI | "Burger + Fries + Drink" combo at $12 instead of $15 |
| M3.11 | Time-based menu (breakfast 6–11am, lunch 11am–3pm, dinner 5–11pm) | Backend | At 2pm, menu API returns lunch items only |
| M3.12 | Day-based menu (Friday Special, Weekend Brunch) | Backend | On Friday, "Friday Fish Fry" item appears |
| M3.13 | Channel-specific pricing (dine-in price vs delivery price) | Backend | Same burger: $9.99 in POS, $11.49 on website |
| M3.14 | Multi-language menu support (item names & descriptions in multiple languages) | Backend + UI | Menu shows in Bengali when customer phone language is BN |
| M3.15 | Bulk menu import from CSV/Excel | Backend + UI | Upload 50-item CSV, all items created with categories |
| M3.16 | Menu item sort ordering within category | Backend + UI | Drag "Cheeseburger" above "Veggie Burger" within Burgers |
| M3.17 | Kitchen station assignment per item (grill, fry, drinks, dessert) | Backend + UI | "Burger" assigned to Grill station, "Coke" to Drinks station |

---

## M4: ORDER ENGINE (Core)
**Phase:** 1 | **Dependencies:** M0, M3
**Priority:** 🔴 CRITICAL — the heart of the entire system

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M4.1 | Create order (items, modifiers, quantities, order type) | Backend | POST /orders creates order with items and modifiers |
| M4.2 | Order pricing calculation (item prices + modifiers + tax + service charge + tip - discount) | Backend | $10 item + $2 modifier + 15% tax + 10% service = correct total |
| M4.3 | Order status state machine (created → pending → confirmed → preparing → ready → served/delivered → completed) | Backend | Cannot transition from "created" directly to "ready" (invalid) |
| M4.4 | Order status update API with validation | Backend | PUT /orders/:id/status with valid transition succeeds |
| M4.5 | Order channel tagging (POS, QR, website, app, aggregator, phone, etc.) | Backend | Each order carries immutable channel_source field |
| M4.6 | Order type handling (dine_in, takeaway, delivery, pickup) | Backend | Dine-in order requires table_id, delivery requires address |
| M4.7 | Discount application (% discount, fixed amount, promo code) | Backend | 20% discount on $50 order = $40 subtotal before tax |
| M4.8 | Order modification after creation (add item, remove item, change quantity — before kitchen starts) | Backend | Can add "Extra Cheese" to order while status is "confirmed" |
| M4.9 | Order cancellation with reason | Backend | Cancel order → status "cancelled", reason stored, inventory reversed |
| M4.10 | Order notes / special instructions (per order and per item) | Backend | "No onions" on Burger item, "Ring doorbell" on order |
| M4.11 | Order number generation (sequential per restaurant per day, resets daily) | Backend | First order of the day is #001, next is #002 |
| M4.12 | Order event emission via WebSocket (for KDS, dashboard, notifications) | Backend | Creating order emits `new_order` event to restaurant room |
| M4.13 | Order history query with filters (date range, status, channel, type) | Backend | GET /orders?from=2026-01-01&channel=pos returns filtered list |
| M4.14 | Order auto-accept timer (if not accepted within X minutes, auto-accept) | Backend | QR order pending for 3 min → auto-transitions to confirmed |

---

## M5: POINT OF SALE (POS)
**Phase:** 1 | **Dependencies:** M0, M1, M3, M4
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M5.1 | POS layout: category sidebar + item grid + cart panel | Frontend | Three-panel layout renders on tablet (1024px+) and adapts to phone |
| M5.2 | Quick item selection (tap category → tap item → added to cart) | Frontend | Under 3 taps from empty cart to first item added |
| M5.3 | Modifier selection popup (when item has required modifiers) | Frontend | Tapping "Pizza" shows size selection before adding to cart |
| M5.4 | Cart management (change quantity, remove item, add notes) | Frontend | +/- buttons change quantity, swipe removes item |
| M5.5 | Order type selector (Dine-In / Takeaway / Pickup) | Frontend | Selecting Dine-In shows table picker, Takeaway hides table picker |
| M5.6 | Table assignment from POS (visual table list or dropdown) | Frontend | Select "Table 5" → order linked to table 5 |
| M5.7 | Discount application UI (% button, fixed amount button, promo code input) | Frontend | Apply 10% → cart total recalculates live |
| M5.8 | Customer search/attach to order (by phone, name, or loyalty card) | Frontend | Type phone number → auto-attach existing customer to order |
| M5.9 | Order summary with tax + service charge + tip breakdown | Frontend | Before payment, screen shows subtotal / tax / service / tip / total |
| M5.10 | Place order button → sends to backend → shows confirmation | Frontend + Backend | Tap "Place Order" → order created → KDS receives it within 1 second |
| M5.11 | Offline order queue (when internet is down, orders stored locally) | Frontend | Turn off WiFi → create order → order stored in local DB → reconnect → syncs |
| M5.12 | Local database (PouchDB/WatermelonDB) for offline menu cache | Frontend | Menu loads from local cache when offline |
| M5.13 | Sync engine (reconcile local orders with server on reconnect) | Frontend + Backend | 5 offline orders sync correctly when internet returns, no duplicates |
| M5.14 | Order recall / hold / park (save order, continue later) | Frontend | Park order → start new order → recall parked order |
| M5.15 | Multi-terminal support (multiple POS devices in same restaurant) | Backend | Two tablets both show same menu and orders, no conflicts |
| M5.16 | POS shift management (open shift / close shift / cash count) | Frontend + Backend | Open shift with $100 float → at close, system shows cash reconciliation |

---

## M6: KITCHEN DISPLAY SYSTEM (KDS)
**Phase:** 1 | **Dependencies:** M0, M4
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M6.1 | KDS screen layout (order cards in grid or list view) | Frontend | Orders display as cards with items, modifiers, table number |
| M6.2 | Real-time order appearance (WebSocket-driven, instant when order placed) | Frontend | Place order on POS → KDS shows it within 1 second |
| M6.3 | Color-coded urgency timer (green 0–5min, yellow 5–10min, red 10min+) | Frontend | Order card turns yellow at 5 minutes, red at 10 minutes |
| M6.4 | "Ready" button per order (marks entire order as ready) | Frontend + Backend | Tap Ready → order status changes → waiter/customer notified |
| M6.5 | "Ready" button per item (marks individual items as ready) | Frontend + Backend | Mark "Fries" ready while "Burger" still preparing |
| M6.6 | Order channel label (POS / QR / Website / Foodpanda badge on card) | Frontend | Foodpanda orders show orange Foodpanda badge |
| M6.7 | Order type label (Dine-In Table 5 / Takeaway / Delivery) | Frontend | Card shows "DINE-IN - Table 5" prominently |
| M6.8 | Special instructions highlight (bold/colored on card) | Frontend | "NO ONIONS" displays in red highlight on item |
| M6.9 | Sound alert on new order (configurable sound + volume) | Frontend | New order triggers audible beep, adjustable in settings |
| M6.10 | KDS station filtering (Grill station sees only grill items) | Frontend + Backend | Grill KDS shows "Burger" but not "Coke" from same order |
| M6.11 | Completed orders archive (move to "done" column or hide) | Frontend | Tapping Ready slides card to completed section |
| M6.12 | Recall completed order (bring back to active if mistake) | Frontend + Backend | Tap on completed order → moves back to active queue |
| M6.13 | Order bumping (move order to top priority) | Frontend + Backend | Tap bump → order moves to position 1 in queue |
| M6.14 | Prep time tracking (time from confirmed to ready, per item) | Backend | Analytics shows average prep time per menu item |
| M6.15 | Full-screen mode (no browser chrome, kiosk-style for wall-mounted screens) | Frontend | F11 or auto-fullscreen on dedicated KDS device |

---

## M7: TABLE MANAGEMENT (Basic)
**Phase:** 1 | **Dependencies:** M0, M2
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M7.1 | Table CRUD (table number, capacity, section name) | Backend + UI | Create "Table 1", capacity 4, section "Indoor" |
| M7.2 | Table status tracking (available / occupied / reserved / needs cleaning) | Backend + UI | When order placed for table → status auto-changes to "occupied" |
| M7.3 | Table list view with status colors | Frontend | Green = available, Red = occupied, Blue = reserved, Yellow = cleaning |
| M7.4 | Assign order to table (from POS) | Frontend + Backend | Select table → start order → table becomes occupied |
| M7.5 | Close table (order completed + paid → table returns to available) | Backend | Payment completed → table status → "needs cleaning" → then "available" |
| M7.6 | Table session: track all orders for same table visit | Backend | Table 5 has Order #12 and Order #15 in same session |
| M7.7 | Merge tables (combine 2 tables into 1 group) | Backend + UI | Merge Table 3 and Table 4 → both show same order |
| M7.8 | Transfer order between tables | Backend + UI | Move order from Table 5 to Table 8 → table statuses update |
| M7.9 | QR code generation per table (unique URL, downloadable PDF) | Backend | Generate QR for Table 5 → URL: order.restrocloud.com/abc/table/5 |

---

## M8: PAYMENT PROCESSING (Basic)
**Phase:** 1 | **Dependencies:** M0, M4
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M8.1 | Cash payment: record amount received, calculate change | Backend + UI | Pay $50 cash on $43.50 order → change = $6.50 |
| M8.2 | Card payment: manual recording (card processed externally, marked "paid by card") | Backend + UI | Select "Card" → mark order as paid → receipt generated |
| M8.3 | Split bill by equal division (total ÷ guests) | Backend + UI | $100 bill ÷ 4 guests = $25 each |
| M8.4 | Split bill by item (each person pays for their items) | Backend + UI | Person A pays for burger + fries, Person B pays for salad + drink |
| M8.5 | Split bill by custom amount | Backend + UI | Person A pays $60, Person B pays $40 |
| M8.6 | Mixed payment (part cash, part card) | Backend + UI | $30 cash + $20 card on $50 order = fully paid |
| M8.7 | Receipt generation (order details, payment, tax breakdown) | Backend | Receipt contains all items, prices, tax lines, total, change |
| M8.8 | Thermal printer integration (ESC/POS protocol) | Frontend | Receipt prints on connected thermal printer |
| M8.9 | Email receipt | Backend | After payment, customer receives email with receipt PDF |
| M8.10 | SMS receipt (send receipt link via SMS) | Backend | Customer receives SMS: "Your receipt: link" |
| M8.11 | Refund processing (full or partial refund) | Backend + UI | Refund $5 on $50 order → refund recorded → linked to payment |
| M8.12 | Daily cash report (Z-report): total sales, by payment method, cash in drawer | Backend | End-of-day report shows: $500 cash, $800 card, $200 wallet |
| M8.13 | Payment-before-food vs payment-after-food toggle (per restaurant config) | Backend | Table service restaurant collects payment after meal |

---

## M9: RESTAURANT ADMIN DASHBOARD
**Phase:** 1 | **Dependencies:** M0, M1, M2, M3, M4
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M9.1 | Dashboard home: today's sales, order count, revenue chart | Frontend | Shows live sales total, order count, hourly revenue bar chart |
| M9.2 | Menu management interface (CRUD for categories, items, modifiers) | Frontend | Full menu editing from dashboard with photo upload |
| M9.3 | Order list view (all orders today, filterable by status/channel) | Frontend | Filter by "Preparing" shows only orders being prepared |
| M9.4 | Order detail view (items, customer, payment, status history) | Frontend | Click order → see full details with timeline |
| M9.5 | Staff management (add/edit/remove staff, assign roles) | Frontend | Add new waiter, assign "waiter" role, generate PIN |
| M9.6 | Restaurant settings page (profile, hours, tax, tips, payments) | Frontend | All restaurant configuration editable from one settings page |
| M9.7 | Basic sales report (daily/weekly/monthly totals, by payment method) | Frontend | Report shows: this week $5,000 total, $3,000 card, $2,000 cash |
| M9.8 | Navigation sidebar with permission-based menu visibility | Frontend | Waiter role doesn't see "Reports" or "Settings" in sidebar |

---

## M10: SUPER ADMIN PANEL (Basic)
**Phase:** 1 | **Dependencies:** M0, M1
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M10.1 | Super admin login (separate auth from restaurant users) | Backend + UI | Super admin credentials work only on admin panel |
| M10.2 | Restaurant list (all tenants, search, filter by country/plan/status) | Frontend | Search "Joe" → shows "Joe's Burgers" restaurant record |
| M10.3 | Restaurant detail view (profile, plan, billing, order stats) | Frontend | Click restaurant → see all details in one view |
| M10.4 | Create restaurant manually (for onboarding via support team) | Backend + UI | Super admin creates restaurant and owner account |
| M10.5 | Suspend / activate restaurant | Backend + UI | Suspended restaurant shows "Account Suspended" on login |
| M10.6 | Platform dashboard (total restaurants, total orders, total revenue today) | Frontend | Shows 3 KPI cards with real-time numbers |
| M10.7 | Impersonate restaurant owner (login as them for troubleshooting, with audit log) | Backend + UI | Impersonate → see their dashboard → all actions logged |

---

## M11: NOTIFICATION SERVICE (Basic)
**Phase:** 1 | **Dependencies:** M0
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M11.1 | In-app notification system (bell icon + dropdown in dashboard) | Frontend + Backend | New order → bell shows badge → dropdown shows notification |
| M11.2 | WebSocket push to connected clients (real-time) | Backend | New order event → all connected POS/KDS/dashboard get it instantly |
| M11.3 | Sound alert system (configurable per notification type) | Frontend | New order plays "ding" sound, low stock plays different alert |
| M11.4 | Email notification sender (via SendGrid/SES) | Backend | Order confirmed → customer gets email |
| M11.5 | SMS notification sender (via Twilio or local provider) | Backend | Order ready for pickup → customer gets SMS |
| M11.6 | Notification preferences (per user: which notifications, which channels) | Backend + UI | Owner enables email for daily reports, disables for every order |

---

## M12: QR TABLE ORDERING
**Phase:** 2 | **Dependencies:** M0, M3, M4, M7, M8, M14
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M12.1 | QR URL handler: parse restaurant slug + table number from URL | Backend | order.restrocloud.com/joes-burgers/table/5 → loads correct restaurant, table 5 |
| M12.2 | Customer-facing menu PWA shell (responsive, mobile-first) | Frontend | Opens on any phone browser, looks like native app |
| M12.3 | Menu browsing: categories, items with photos, descriptions, prices | Frontend | Customer sees categorized menu with images |
| M12.4 | Language auto-detection (from phone settings) | Frontend | Bengali phone → menu shows in Bengali (if translations exist) |
| M12.5 | Item detail view with modifier selection | Frontend | Tap "Burger" → select size, toppings → add to cart |
| M12.6 | Cart management (add, remove, change quantity, notes) | Frontend | Cart persists across category browsing |
| M12.7 | Upsell / cross-sell suggestions ("Add a drink?") | Frontend + Backend | After adding main, system suggests frequently paired items |
| M12.8 | Place order → send to kitchen via API | Frontend + Backend | Tap "Place Order" → order appears on KDS within 2 seconds |
| M12.9 | "Pay Now" vs "Pay Later" selection | Frontend | Pay Now → redirects to payment, Pay Later → order placed without payment |
| M12.10 | Order confirmation and real-time status tracking screen | Frontend | Shows "Preparing..." with live status updates |
| M12.11 | Multi-order table session (additional orders link to same table) | Backend | Second QR scan at same table adds to existing session |
| M12.12 | "Call Waiter" button | Frontend + Backend | Tap → notification sent to waiter's device |
| M12.13 | "Request Bill" flow (shows total for all orders at table) | Frontend + Backend | Shows combined bill → pay options |
| M12.14 | Post-meal feedback prompt (1–5 star rating + comment) | Frontend + Backend | After payment → "How was your experience?" popup |

---

## M13: ONLINE ORDERING WEBSITE
**Phase:** 2 | **Dependencies:** M0, M1, M2, M3, M4, M14, M15
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M13.1 | Restaurant website template engine (3–5 selectable themes) | Frontend | Owner picks "Modern" theme → website renders with that design |
| M13.2 | Custom domain / subdomain support (yourname.restrocloud.site or custom) | Infrastructure | joesburgers.restrocloud.site resolves correctly |
| M13.3 | Restaurant landing page (about, hours, location, contact, gallery) | Frontend | Homepage shows restaurant info beautifully |
| M13.4 | "Order Now" page: delivery vs pickup selection | Frontend | Select "Delivery" → enter address → validate zone |
| M13.5 | Delivery zone validation (geocoding + zone check) | Backend | Address inside zone → proceed. Address outside → "Out of range" |
| M13.6 | Delivery fee calculation (flat, distance-based, or free above minimum) | Backend | 3km delivery = $2 fee, $50+ order = free delivery |
| M13.7 | Menu display with search, filters (dietary, allergen), categories | Frontend | Type "vegan" → shows only vegan items |
| M13.8 | Cart and checkout flow | Frontend | Add items → go to cart → review → checkout |
| M13.9 | Guest checkout (name, phone, email, address — no account required) | Frontend + Backend | Order placed without creating an account |
| M13.10 | Customer account: register, login, order history, saved addresses | Frontend + Backend | Returning customer logs in → address auto-filled |
| M13.11 | Promo code input at checkout | Frontend + Backend | Enter "WELCOME10" → 10% discount applied |
| M13.12 | Estimated delivery/pickup time display | Backend + Frontend | "Estimated delivery: 35–45 minutes" |
| M13.13 | Order confirmation page with order number and tracking link | Frontend | After payment → shows order #, estimated time, track link |
| M13.14 | SEO basics (meta tags, structured data for Google) | Frontend | Google can index restaurant and show in search results |
| M13.15 | Google Analytics integration | Frontend | Page views and conversions tracked |

---

## M14: PAYMENT GATEWAY INTEGRATION (Online)
**Phase:** 2 | **Dependencies:** M0, M8
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M14.1 | Stripe integration: create checkout session, process payment, handle webhook | Backend | Card payment succeeds, webhook confirms payment |
| M14.2 | SSLCommerz integration (Bangladesh) | Backend | bKash/Nagad payment succeeds via SSLCommerz |
| M14.3 | Razorpay integration (India) | Backend | UPI/card payment succeeds via Razorpay |
| M14.4 | Payment status tracking (pending → completed → failed → refunded) | Backend | Failed payment → order not confirmed, customer notified |
| M14.5 | Webhook handler: update order + payment status on gateway callback | Backend | Stripe sends "payment_intent.succeeded" → order confirmed |
| M14.6 | Cash on Delivery (COD) recording | Backend | Order placed with COD → driver collects cash → marks as paid |
| M14.7 | Payment gateway configuration per restaurant (owner connects their Stripe/SSLCommerz account) | Backend + UI | Owner enters Stripe API key → payments go to their account |
| M14.8 | Transaction fee calculation and recording (our platform cut) | Backend | $100 order × 2% = $2 platform fee tracked |

---

## M15: CUSTOMER ACCOUNTS & DATABASE
**Phase:** 2 | **Dependencies:** M0, M1
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M15.1 | Customer auto-creation from orders (phone/email as identifier) | Backend | First order creates customer record automatically |
| M15.2 | Customer profile: name, phone, email, addresses, notes | Backend + UI | View customer profile with all details |
| M15.3 | Order history per customer | Backend + UI | Customer profile shows all past orders |
| M15.4 | Customer search (by name, phone, email) | Backend + UI | Search "0171" → shows matching customers |
| M15.5 | Saved addresses (delivery customers can store multiple addresses) | Backend | Customer has "Home" and "Office" addresses saved |
| M15.6 | Customer merge (deduplicate same customer with different records) | Backend + UI | Merge phone-only record with email-only record for same person |
| M15.7 | Customer tags (VIP, regular, allergies noted) | Backend + UI | Tag customer as "VIP" → POS shows VIP badge on their orders |

---

## M16: ORDER MANAGEMENT (Enhanced)
**Phase:** 2 | **Dependencies:** M4, M11
**Priority:** 🔴 CRITICAL

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M16.1 | Unified order dashboard: ALL channels in one list (POS + QR + Website) | Frontend | Single order list shows orders from all channels with badges |
| M16.2 | Order accept / reject actions for pending orders | Frontend + Backend | Incoming QR order → Accept button → status changes to Confirmed |
| M16.3 | Auto-accept timer (configurable per channel: auto-accept after X minutes) | Backend | QR order not acted on for 3 minutes → auto-confirmed |
| M16.4 | Order status update from dashboard (preparing → ready → served) | Frontend + Backend | Manager clicks "Mark Ready" → KDS updates, customer notified |
| M16.5 | New order sound alerts with channel-specific sounds | Frontend | Website order = one sound, aggregator order = different sound |
| M16.6 | Order search and filtering (by date, status, channel, customer, amount) | Frontend | Filter: "Today + Website + Pending" shows relevant orders |
| M16.7 | Order printing (send any order to printer on demand) | Frontend + Backend | Click "Print" → ticket prints on connected printer |

---

## M17: AGGREGATOR INTEGRATION HUB
**Phase:** 3 | **Dependencies:** M0, M3, M4, M11, M16
**Priority:** 🔴 CRITICAL — #1 differentiator

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M17.1 | Aggregator abstraction layer (unified interface for all platforms) | Backend | All aggregators implement same interface: receiveOrder(), updateStatus(), syncMenu() |
| M17.2 | Foodpanda API integration: receive orders | Backend | Foodpanda order appears in RestroCloud dashboard |
| M17.3 | Foodpanda API integration: send status updates (accepted, preparing, ready) | Backend | Accept in RestroCloud → Foodpanda shows "Preparing" |
| M17.4 | Foodpanda API integration: menu sync (push menu changes) | Backend | Mark item out of stock → Foodpanda listing updates |
| M17.5 | Pathao Food API integration: receive orders | Backend | Pathao order appears in unified dashboard |
| M17.6 | Pathao Food API integration: send status updates | Backend | Status changes sync to Pathao |
| M17.7 | Pathao Food API integration: menu sync | Backend | Menu changes push to Pathao |
| M17.8 | Aggregator order display: platform badge, commission info | Frontend | Foodpanda order shows orange badge + "Commission: $3.50" |
| M17.9 | Accept / reject aggregator orders with reason codes | Frontend + Backend | Reject → select reason "Out of stock" → aggregator notified |
| M17.10 | Auto-accept configuration per aggregator | Backend + UI | Auto-accept Foodpanda orders under $100 |
| M17.11 | Auto-print aggregator order tickets | Backend | Foodpanda order → auto-prints on restaurant printer |
| M17.12 | Menu availability sync: out-of-stock pushes to all aggregators simultaneously | Backend | Toggle item off → disabled on Foodpanda + Pathao within 30 seconds |
| M17.13 | Operating hours sync to aggregators | Backend | Close early → aggregator listings show closed |
| M17.14 | Commission tracking per aggregator (% or fixed per order) | Backend | Dashboard shows: Foodpanda commission this month: $450 |
| M17.15 | Revenue comparison report across aggregators | Backend + Frontend | "Foodpanda: $5,000 revenue, $1,250 commission. Pathao: $3,000 revenue, $450 commission." |
| M17.16 | Webhook receiver for aggregator order events | Backend | Aggregator pushes order via webhook → order created in system |
| M17.17 | Aggregator connection setup wizard (OAuth or API key entry) | Frontend + Backend | Owner enters Foodpanda credentials → connection validated → orders start flowing |

---

## M18: DELIVERY MANAGEMENT
**Phase:** 3 | **Dependencies:** M0, M4
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M18.1 | Delivery zone configuration (draw polygon on map) | Frontend + Backend | Draw zone on Google Maps → addresses inside zone are deliverable |
| M18.2 | Delivery fee rules (flat, per-km, tiered, free above minimum order) | Backend | $2 flat fee OR $0.50/km OR free for orders over $30 |
| M18.3 | Driver CRUD (add drivers with name, phone, vehicle type) | Backend + UI | Add "Rahim" as driver, phone: 01XX, motorcycle |
| M18.4 | Manual order-to-driver assignment | Frontend + Backend | Assign delivery order to Rahim → Rahim sees it in his list |
| M18.5 | Driver order list view (simple web page for drivers) | Frontend | Driver opens link → sees assigned orders with addresses |
| M18.6 | Driver status update (picked up → on the way → delivered) | Frontend + Backend | Driver marks "Delivered" → customer gets notification |
| M18.7 | Customer order tracking page (basic: status updates, no live map yet) | Frontend | Customer sees: "Your order is on the way!" with timestamps |
| M18.8 | Estimated delivery time calculation (prep time + travel time) | Backend | 15 min prep + 20 min travel = "Estimated delivery: 35 minutes" |

---

## M19: REPORTING & ANALYTICS (Basic)
**Phase:** 3 | **Dependencies:** M0, M4, M8
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M19.1 | Daily sales report (total revenue, order count, average order value) | Backend + Frontend | Today: $2,500 revenue, 85 orders, $29.41 avg |
| M19.2 | Sales by channel (POS vs QR vs Website vs Aggregators) | Backend + Frontend | POS: $1,200, Website: $800, Foodpanda: $500 |
| M19.3 | Sales by payment method (cash vs card vs wallet vs COD) | Backend + Frontend | Cash: $600, Card: $1,400, bKash: $500 |
| M19.4 | Sales by hour (bar chart showing peak hours) | Backend + Frontend | 12pm–1pm is highest revenue hour |
| M19.5 | Top-selling items (quantity and revenue) | Backend + Frontend | #1 Cheeseburger (142 sold, $1,350) |
| M19.6 | Order volume by day/week/month (line chart) | Backend + Frontend | This month trending up 15% vs last month |
| M19.7 | Aggregator commission summary (per platform, per period) | Backend + Frontend | Foodpanda took $450 commission this month |
| M19.8 | Report export (PDF and CSV download) | Backend | Download button generates PDF/CSV of current report |
| M19.9 | Scheduled email reports (daily summary to owner's email) | Backend | Owner gets email at 11pm with day's summary |

---

## M20: INVENTORY & STOCK MANAGEMENT
**Phase:** 4 | **Dependencies:** M0, M3, M4
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M20.1 | Ingredient CRUD (name, unit of measurement, category, current stock) | Backend + UI | Add "Ground Beef", unit: kg, current stock: 25kg |
| M20.2 | Recipe builder: link menu items to ingredients with quantities | Backend + UI | "Cheeseburger" uses 150g ground beef + 30g cheese + 1 bun |
| M20.3 | Auto-deduction on order completion | Backend | Sell 1 cheeseburger → ground beef stock reduces by 150g |
| M20.4 | Stock level alerts (low stock threshold per ingredient) | Backend | Ground beef < 5kg → alert sent to owner |
| M20.5 | Supplier CRUD (name, contact, items they supply, pricing) | Backend + UI | "Fresh Farms" supplies ground beef at $8/kg |
| M20.6 | Purchase order creation and tracking | Backend + UI | Create PO for 50kg ground beef from Fresh Farms → track status |
| M20.7 | Stock receiving (record incoming inventory from PO) | Backend + UI | Receive 50kg → stock increases → PO marked as received |
| M20.8 | Stock take tool (physical count vs system count reconciliation) | Backend + UI | Physical count: 23kg, System says 25kg → variance of 2kg flagged |
| M20.9 | Waste logging (record waste with reason: spoilage, overcooked, dropped) | Backend + UI | Log 2kg ground beef wasted (reason: expired) |
| M20.10 | Food cost percentage report (real-time COGS / revenue) | Backend + Frontend | Food cost this week: 28% (target: under 30%) |
| M20.11 | Theoretical vs actual usage report (variance) | Backend + Frontend | Should have used 50kg beef, actually used 55kg → 10% variance |

---

## M21: CRM & CUSTOMER LOYALTY
**Phase:** 4 | **Dependencies:** M0, M15, M4
**Priority:** 🟡 HIGH

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M21.1 | Customer segmentation engine (VIP / regular / lapsed / new / high-spender) | Backend | Auto-tag customers: spent >$500/month = VIP |
| M21.2 | Points-based loyalty program (earn X points per $ spent) | Backend + UI | Earn 1 point per $1. 100 points = $5 discount |
| M21.3 | Stamp card (buy 9, get 10th free) | Backend + UI | Customer has 7/10 stamps → 2 more to earn free item |
| M21.4 | Loyalty balance display at POS (when customer identified) | Frontend | POS shows "John has 85 points ($4.25 available)" |
| M21.5 | Points redemption during checkout | Frontend + Backend | Customer redeems 50 points → $2.50 discount applied |
| M21.6 | Promo code generator (create codes with rules: %, fixed, min order, expiry) | Backend + UI | Create "SUMMER20" → 20% off, min order $15, expires July 31 |
| M21.7 | Automated birthday offer (email/SMS on customer birthday) | Backend | Customer birthday today → auto-sends "Happy Birthday! 20% off" |
| M21.8 | Re-engagement campaign (email customers who haven't ordered in 30 days) | Backend | "We miss you!" email with $5 off coupon |
| M21.9 | Push notification engine (for mobile app users) | Backend | Send push: "New menu items! Order now" to all app users |
| M21.10 | Customer feedback collection (post-order rating + comment) | Backend + UI | After delivery → "Rate your experience 1–5 stars" |

---

## M22: STAFF & HR MANAGEMENT
**Phase:** 4 | **Dependencies:** M0, M1
**Priority:** 🟢 MEDIUM

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M22.1 | Employee profile CRUD (name, phone, role, hire date, documents) | Backend + UI | Add employee with full profile |
| M22.2 | Shift scheduling (drag-and-drop weekly calendar) | Frontend + Backend | Schedule Rahim for Monday 9am–5pm, Tuesday off |
| M22.3 | Clock in / clock out (PIN, or phone GPS verification) | Frontend + Backend | Staff clocks in at 8:58am, clocks out at 5:05pm |
| M22.4 | Attendance tracking and late arrival alerts | Backend | Rahim was 15 min late 3 times this week → alert to manager |
| M22.5 | Overtime calculation (hours beyond standard, automatic) | Backend | 45 hours worked, 40 standard → 5 hours overtime at 1.5x |
| M22.6 | Tip tracking and distribution | Backend + UI | $200 total tips today → split between 4 servers = $50 each |
| M22.7 | Labor cost as % of revenue (real-time) | Backend + Frontend | Labor cost today: 32% of revenue (target: under 30%) |
| M22.8 | Leave request and approval workflow | Backend + UI | Staff requests day off → manager approves/rejects |

---

## M23: OWNER MOBILE APP
**Phase:** 4 | **Dependencies:** M0, M1, M9
**Priority:** 🟢 MEDIUM

| ID | Sub-Component | Type | Test Criteria |
|----|--------------|------|---------------|
| M23.1 | React Native app shell (iOS + Android) | Mobile | App installs and launches on both platforms |
| M23.2 | Dashboard view: today's sales, order count, live orders | Mobile | Shows same KPIs as web dashboard |
| M23.3 | Order notifications (push notification for new orders) | Mobile | New website order → phone buzzes with notification |
| M23.4 | Accept/reject orders from phone | Mobile | Tap notification → accept order → KDS receives it |
| M23.5 | Low stock alerts | Mobile | Push: "Ground beef is below 5kg" |
| M23.6 | Quick menu toggle (mark items in/out of stock from phone) | Mobile | Swipe to mark "Cheeseburger" out of stock |

---

## M24–M43: TIER 5–6 MODULES (Scale & Ecosystem)

These modules follow the same breakdown pattern. For brevity, here are the key sub-components for each:

### M24: MULTI-LOCATION MANAGEMENT
| ID | Key Sub-Components |
|----|--------------------|
| M24.1 | Location CRUD under single owner account |
| M24.2 | Consolidated dashboard (all locations at a glance) |
| M24.3 | Per-location and aggregated reporting |
| M24.4 | Global menu with per-location price overrides |
| M24.5 | Inter-location stock transfers |
| M24.6 | Location performance comparison / leaderboard |
| M24.7 | Location-scoped staff permissions |

### M25: WHITE-LABEL CUSTOMER MOBILE APP
| ID | Key Sub-Components |
|----|--------------------|
| M25.1 | React Native app with restaurant branding (logo, colors, fonts) |
| M25.2 | Menu browsing, item customization, cart, checkout |
| M25.3 | Push notifications (order status, promotions) |
| M25.4 | Loyalty program integration (points balance, redeem) |
| M25.5 | Order history and one-tap re-order |
| M25.6 | Saved addresses and payment methods |
| M25.7 | Live delivery tracking (map view) |
| M25.8 | App Store / Play Store deployment pipeline |

### M26: SELF-SERVICE KIOSK
| ID | Key Sub-Components |
|----|--------------------|
| M26.1 | Fullscreen kiosk mode (no browser chrome, auto-launch) |
| M26.2 | Large-format menu UI with big food photos |
| M26.3 | Touchscreen-optimized modifier selection |
| M26.4 | Upsell/combo suggestion engine |
| M26.5 | Integrated payment terminal support (card reader, NFC) |
| M26.6 | Dine-in vs takeaway selection flow |
| M26.7 | Receipt printing from kiosk |
| M26.8 | Idle screen / attract mode (slideshow when not in use) |

### M27: ADVANCED ANALYTICS & AI
| ID | Key Sub-Components |
|----|--------------------|
| M27.1 | Custom report builder (drag-and-drop metrics) |
| M27.2 | AI demand forecasting (predict next week's orders by item) |
| M27.3 | Menu optimization (highlight high-margin items, flag underperformers) |
| M27.4 | Waste reduction recommendations |
| M27.5 | Staff scheduling optimization (match staffing to predicted demand) |
| M27.6 | Peak hour analysis (heatmap by hour/day) |
| M27.7 | Customer lifetime value calculation |
| M27.8 | Cohort analysis (retention by signup month) |

### M28: ACCOUNTING INTEGRATION
| ID | Key Sub-Components |
|----|--------------------|
| M28.1 | QuickBooks Online API integration (push daily sales) |
| M28.2 | Xero API integration (push daily sales) |
| M28.3 | Tally integration (India market) |
| M28.4 | Auto-generated P&L statement |
| M28.5 | Tax report generation per jurisdiction |
| M28.6 | Invoice generation for corporate/catering clients |
| M28.7 | Bank reconciliation data export |

### M29: TABLE MANAGEMENT (Advanced)
| ID | Key Sub-Components |
|----|--------------------|
| M29.1 | Visual drag-and-drop floor plan builder (shapes, walls, decorations) |
| M29.2 | Online reservation booking (from website/app) |
| M29.3 | Reservation calendar with slot management |
| M29.4 | Waitlist management with queue position display |
| M29.5 | SMS/WhatsApp "your table is ready" notification |
| M29.6 | No-show tracking with deposit forfeiture |
| M29.7 | Table turn time analytics |
| M29.8 | Integration with Google Reserve / OpenTable |

### M30: DIGITAL MENU DISPLAY
| ID | Key Sub-Components |
|----|--------------------|
| M30.1 | Menu board template engine (horizontal, vertical, multi-zone) |
| M30.2 | Real-time sync with central menu (price/availability changes instant) |
| M30.3 | Daypart auto-switching (breakfast → lunch → dinner) |
| M30.4 | Promotional content areas (featured items, limited offers) |
| M30.5 | Multi-screen management (assign different content per screen) |
| M30.6 | Customer-facing order status display (order number + status) |
| M30.7 | Estimated wait time display |

### M31: SUPER ADMIN PANEL (Full)
| ID | Key Sub-Components |
|----|--------------------|
| M31.1 | Financial dashboard (MRR, ARR, churn, LTV, CAC) |
| M31.2 | Subscription & billing management (plans, invoices, coupons) |
| M31.3 | Feature flag management (enable/disable per restaurant) |
| M31.4 | Support ticket system |
| M31.5 | System health monitoring (uptime, response times, error rates) |
| M31.6 | Email campaign tool (broadcast to all restaurants) |
| M31.7 | Country manager role (access scoped to one country) |
| M31.8 | Marketplace management (review plugins, approve listings) |
| M31.9 | Audit log viewer (all super admin actions) |

### M32: DRIVE-THROUGH MODULE
| ID | Key Sub-Components |
|----|--------------------|
| M32.1 | Speed-optimized POS interface (minimal taps, large buttons) |
| M32.2 | Customer-facing order confirmation display |
| M32.3 | Drive-through priority flag on KDS |
| M32.4 | Speed-of-service timer (order → payment → pickup timestamps) |
| M32.5 | Lane queue management |

### M33: WHATSAPP & CHAT ORDERING
| ID | Key Sub-Components |
|----|--------------------|
| M33.1 | WhatsApp Business API connection |
| M33.2 | AI chatbot conversation flow (greet → menu → order → confirm → pay) |
| M33.3 | Natural language order parsing ("2 burgers and a coke") |
| M33.4 | Payment link generation and sending via WhatsApp |
| M33.5 | Human handoff (transfer chat to staff when AI can't handle) |
| M33.6 | Order status updates sent via WhatsApp |
| M33.7 | Facebook Messenger integration (same chatbot) |

### M34: CATERING & BULK ORDERS
| ID | Key Sub-Components |
|----|--------------------|
| M34.1 | Catering menu (separate from regular menu, platter/per-person pricing) |
| M34.2 | Quote request form (items, quantity, date, address) |
| M34.3 | Quote builder (manager creates custom pricing) |
| M34.4 | Quote approval flow (email to customer → approve link) |
| M34.5 | Deposit payment collection (partial payment at booking) |
| M34.6 | Scheduled order with prep timeline |
| M34.7 | Corporate account management with invoicing |

### M35: GIFT CARD SYSTEM
| ID | Key Sub-Components |
|----|--------------------|
| M35.1 | Digital gift card creation (unique code, amount, design) |
| M35.2 | Sell gift cards via POS, website, app |
| M35.3 | Send digital card via email or WhatsApp |
| M35.4 | Redeem at checkout (enter code → balance deducted) |
| M35.5 | Partial redemption support (use $10 of $25 card) |
| M35.6 | Balance check (by code or customer profile) |
| M35.7 | Corporate bulk purchase (buy 50 cards at once) |

### M36: SUBSCRIPTION & MEAL PLANS
| ID | Key Sub-Components |
|----|--------------------|
| M36.1 | Plan CRUD (name, frequency, items, pricing) |
| M36.2 | Customer subscription signup flow |
| M36.3 | Preference management (dietary, favorites, exclusions) |
| M36.4 | Auto-order generation on schedule (cron job) |
| M36.5 | Skip / pause / modify day |
| M36.6 | Auto-payment charging on billing cycle |
| M36.7 | Subscription analytics (active, churned, revenue) |

### M37: OPEN API & MARKETPLACE
| ID | Key Sub-Components |
|----|--------------------|
| M37.1 | Public REST API with versioning (v1/v2) |
| M37.2 | API key generation and management per restaurant |
| M37.3 | API documentation portal (interactive, with code samples) |
| M37.4 | Webhook system (configurable event subscriptions) |
| M37.5 | Plugin marketplace storefront (browse, install, uninstall) |
| M37.6 | Developer registration and plugin submission workflow |
| M37.7 | Plugin review and approval process |
| M37.8 | Marketplace revenue tracking (commission per sale) |
| M37.9 | Sandbox environment for developer testing |

### M38: MULTI-BRAND / CLOUD KITCHEN
| ID | Key Sub-Components |
|----|--------------------|
| M38.1 | Virtual brand CRUD (name, logo, menu, branding) under one account |
| M38.2 | Per-brand menu management (separate menus) |
| M38.3 | Per-brand ordering website/page |
| M38.4 | Per-brand aggregator listings |
| M38.5 | Unified KDS across all brands (combined kitchen queue) |
| M38.6 | Shared inventory management across brands |
| M38.7 | Per-brand P&L and analytics |

### M39: FOOD SAFETY & COMPLIANCE
| ID | Key Sub-Components |
|----|--------------------|
| M39.1 | Digital checklist builder (opening, closing, hygiene) |
| M39.2 | Checklist completion tracking (who, when, all items checked) |
| M39.3 | Temperature logging with timestamp and alerts |
| M39.4 | Equipment maintenance scheduling |
| M39.5 | Ingredient expiry tracking with FIFO alerts |
| M39.6 | HACCP documentation storage |
| M39.7 | Inspection readiness report (all records in one view) |

### M40: ADVANCED DELIVERY (Driver App + Live Tracking)
| ID | Key Sub-Components |
|----|--------------------|
| M40.1 | Driver mobile app (React Native, iOS + Android) |
| M40.2 | GPS location tracking (real-time driver position) |
| M40.3 | Auto-assignment (nearest available driver to order) |
| M40.4 | Route optimization (multi-stop delivery route) |
| M40.5 | Customer live tracking page (map with driver position) |
| M40.6 | Proof of delivery (photo, signature, or PIN) |
| M40.7 | Driver performance analytics (deliveries/hour, on-time %, ratings) |
| M40.8 | Third-party delivery partner integration (Lalamove, Pathao rides) |

### M41: VOICE ORDERING (AI)
| ID | Key Sub-Components |
|----|--------------------|
| M41.1 | Phone number routing to AI voice agent |
| M41.2 | Speech-to-text engine integration |
| M41.3 | LLM-based order intent parsing (match spoken items to menu) |
| M41.4 | Text-to-speech response generation |
| M41.5 | Order confirmation and payment link via SMS |
| M41.6 | Fallback to human staff (transfer call) |
| M41.7 | Voice ordering analytics (success rate, fallback rate) |

### M42: SOCIAL MEDIA & GOOGLE ORDERING
| ID | Key Sub-Components |
|----|--------------------|
| M42.1 | Instagram "Order Now" button configuration guide |
| M42.2 | Facebook Shop / action button setup |
| M42.3 | UTM tracking for social media orders |
| M42.4 | Google Business Profile "Order Online" link setup |
| M42.5 | Google Food Ordering API integration (if using native ordering) |

### M43: RESERVATION + PRE-ORDER (Advanced)
| ID | Key Sub-Components |
|----|--------------------|
| M43.1 | Online reservation form (date, time, guests, seating preference) |
| M43.2 | Availability calendar with slot management |
| M43.3 | Pre-order during reservation (browse menu, select items per guest) |
| M43.4 | Deposit collection at booking (no-show protection) |
| M43.5 | Automated reminders (24hr, 2hr before) |
| M43.6 | Arrival marking (host marks "Arrived" → pre-order fires to kitchen) |
| M43.7 | No-show handling (mark no-show → deposit kept → table released) |

---

# TOTAL SUB-COMPONENT COUNT

| Tier | Modules | Estimated Sub-Components | Weeks |
|------|---------|------------------------|-------|
| Tier 0: Foundation | 1 module (M0) | ~27 sub-components | 1–4 |
| Tier 1: MVP Core | 11 modules (M1–M11) | ~120 sub-components | 5–12 |
| Tier 2: Digital Channels | 5 modules (M12–M16) | ~70 sub-components | 13–20 |
| Tier 3: Aggregators + Delivery | 3 modules (M17–M19) | ~45 sub-components | 21–28 |
| Tier 4: Back-Office | 4 modules (M20–M23) | ~50 sub-components | 29–36 |
| Tier 5: Scale | 8 modules (M24–M31) | ~65 sub-components | 37–48 |
| Tier 6: Ecosystem | 12 modules (M32–M43) | ~85 sub-components | 49–64 |
| **TOTAL** | **44 modules** | **~462 sub-components** | **64 weeks** |

---

# HOW TO USE THIS DOCUMENT

1. **For sprint planning:** Pick a module from the current tier. Break its sub-components into 2-week sprints. Each sub-component is roughly 1–3 days of development work.

2. **For task creation:** Each sub-component ID (e.g., M5.11) becomes a task in your project management tool (Jira, Linear, Notion). The "Test Criteria" column becomes the acceptance criteria.

3. **For development with Claude:** Feed Claude one sub-component at a time. For example: "Build M4.3: Order status state machine. Here are the valid transitions: created → pending → confirmed → preparing → ready → served → completed. Also allow: any state → cancelled. Write NestJS service + unit tests."

4. **For QA testing:** The "Test Criteria" column is your test case. If the criteria passes, the sub-component is done.

5. **For progress tracking:** Count completed sub-components / total sub-components per module to get % completion.

---

*This document is the development-ready companion to the RestroCloud Product Documentation v3.0.*
