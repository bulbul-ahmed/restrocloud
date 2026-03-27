# RestroCloud — MVP Launch Checklist
> Last updated: 2026-03-26 (P3 #10 Offline POS complete)

This document tracks all gaps identified before MVP launch across the 4 core ordering channels:
**Dine-in POS · Takeaway · QR Table Ordering · Online Ordering**

---

## Status Legend
- 🔴 `TODO` — Not started
- 🟡 `IN PROGRESS` — Being worked on
- ✅ `DONE` — Complete and tested

---

## ✅ Priority 1 — Launch Blockers — ALL COMPLETE

All P1 items resolved as of 2026-03-22.

---

### 1. Audio alert + real-time notification for incoming orders
**Status:** ✅ DONE
**Effort:** Small
**Affects:** QR Table Ordering, Online Ordering

**What was built:**
- Added `new_order` WebSocket listener in `OrdersPage.tsx` (event emitted by backend on every new order)
- Plays a 3-note ascending chime (D5 → F#5 → A5) via Web Audio API — no audio file needed
- Shows a 10-second toast: "🔔 New QR Table order" with order number, table (if applicable), item count, and total
- Refreshes the orders list immediately so the new order appears at the top
- Channel label maps correctly: QR → "QR Table", ONLINE → "Online", DINE_IN → "Dine-in", etc.
- Audio gracefully silent if browser blocks AudioContext before user gesture

---

### 2. Pending orders inbox / filter in Orders page
**Status:** ✅ DONE
**Effort:** Small
**Affects:** QR Table Ordering, Online Ordering

**What was built:**
- Amber highlighted `PendingInbox` panel appears at the top of OrdersPage whenever PENDING orders exist
- Live countdown timer per order ticking every second: "Auto-accepts in 2:45" (or "Manual review" if not configured)
- Countdown reads per-channel `autoAcceptMinutes` from `GET /restaurants/:id/auto-accept-timer`
- Accept (green) / Reject (red) buttons inline — no need to open detail dialog
- Reject opens reason dialog (optional reason)
- Polls every 10s independently from the main list; also refreshes on socket events
- Panel hides automatically when no pending orders remain

---

### 3. QR code URL must point to frontend-ordering app
**Status:** ✅ DONE
**Effort:** Small
**Affects:** QR Table Ordering

**What was built:**
- Added `qrBaseUrl String?` to Restaurant schema (`prisma db push`)
- `generateQrCode()` now reads `restaurant.qrBaseUrl`; defaults to `https://order.restrocloud.com` if not set
- URL format: `{qrBaseUrl}/table/{restaurantId}/{tableId}` — correct format for `frontend-ordering` Next.js app
- New endpoint: `PATCH /restaurants/:id/qr-settings` — saves qrBaseUrl per restaurant
- Frontend: "QR Table Ordering URL" card added to Settings → Ordering tab
- Shows live preview of the full URL pattern as restaurant types
- After saving, staff must regenerate table QR codes for new URL to take effect

---

### 4. Item price 0 allowed on creation
**Status:** ✅ DONE
**Effort:** Tiny
**Affects:** All channels (affects menu quality)

**What was built:**
- Amber warning appears below the price field in the item create/edit dialog whenever price is ৳0.00
- "⚠ Price is ৳0.00 — is this item free?" — not a hard block, staff can still save
- Only shows when there is no validation error on the field (avoids double messages)
- Single line change in `ItemsPage.tsx`, no other files touched

---

## 🟡 Priority 2 — Should Fix Before Launch — 4 REMAINING

Standard features in all competitor POS systems. Restaurants will ask for these on day one.

---

### 5. Takeaway — notify customer when order is ready
**Status:** ✅ DONE
**Effort:** Medium
**Affects:** Takeaway

**What was built:**
- Public customer display screen at `/display/:restaurantId` — no login required, designed for a TV/tablet at the counter
- **Left panel**: "Now Serving" — all READY TAKEAWAY/DINE_IN orders shown as large bold order numbers with pulsing green indicator
- **Right panel**: "Recently Collected" — SERVED/COMPLETED orders from the last 30 minutes (faded, so customers can confirm theirs was called)
- Live clock in header, auto-refreshes every 15 seconds via polling
- Backend: new public `GET /api/display/:restaurantId` endpoint (no auth) — returns restaurant info + ready + recentlyServed orders
- New files: `backend/src/orders/display.controller.ts`, `frontend-dashboard/src/pages/display/CustomerDisplayPage.tsx`
- Route added to router as a public route (outside AppLayout/auth guard)
- **Usage**: Open `http://localhost:3001/display/{restaurantId}` on a counter TV or tablet

---

### 6. Table transfer in POS
**Status:** ✅ DONE
**Effort:** Medium
**Affects:** Dine-in POS

**What was built:**
- Backend: `transferSession()` in `tables.service.ts` — finds OPEN/BILL_REQUESTED session, verifies target is AVAILABLE, runs `$transaction` moving session + all orders to target table, sets source→AVAILABLE, target→OCCUPIED
- Backend: `PATCH /restaurants/:id/tables/:tableId/sessions/current/transfer` (MANAGER+)
- Frontend: `posApi.transferSession()` in `pos.api.ts`
- Frontend: "Move Table" button in session header (visible to MANAGER/OWNER only, only when session is OPEN)
- Frontend: `TransferTableDialog` — grid of available tables; click to select, confirm to transfer
- On success: deselects current table, refreshes floor plan

---

### 7. POS does not show pending QR orders from tables
**Status:** ✅ DONE
**Effort:** Medium
**Affects:** Dine-in + QR Table Ordering

**What was built:**
- Backend: added `channel` to the orders select in `getTablesOverview()` so QR orders are identifiable
- Frontend type: added `channel: string` to orders in `POSTableSummary`
- POS `TableCard`: shows 3 new badges on occupied tables:
  - `X orders` — total active order count (white pill)
  - `X pending` — pulsing amber badge when PENDING orders exist (staff must act)
  - `QR` — indicator when any order came via QR code
- Order total moved to right side of guest count row for cleaner layout

---

### 8. Payment gateway live credentials UI
**Status:** ✅ DONE
**Effort:** Medium
**Affects:** Online Ordering, QR Table Ordering (pay-at-table)

**What was built:**
- Schema: `PaymentGatewayConfig` model (`gateway`, `apiKey`, `secretKey`, `webhookSecret`, `isLive`, `isActive`) — unique per restaurant+gateway
- Backend: `GET /restaurants/:id/payment-gateways` (list, keys masked after first 4 chars)
- Backend: `PATCH /restaurants/:id/payment-gateways/:gateway` (upsert credentials)
- Frontend: new "Gateways" tab in Settings with cards for Stripe, bKash, SSLCommerz
- Each card shows: configured status badge (Live/Test/Disabled), masked key preview, expand-to-edit form
- Secret fields have show/hide toggle; live mode has a red warning badge
- Blank key fields are ignored on save so existing keys aren't overwritten accidentally

---

## 🟢 Priority 3 — Post-MVP (V1.1)

Nice to have. Won't block launch but improves experience.

---

### 9. Thermal receipt printer support
**Status:** 🔴 TODO
**Effort:** Large
**Affects:** Dine-in POS, Takeaway

**Problem:**
No ESC/POS thermal printer SDK integration exists. Restaurants need to print physical receipts and kitchen tickets.

**What to build:**
- Printer settings UI: IP address, port, printer model
- Print receipt on order completion from POS
- Print kitchen ticket to separate kitchen printer
- Consider: browser-based printing as fallback (window.print)

---

### 10. Offline POS mode
**Status:** ✅ DONE
**Effort:** Very Large
**Affects:** Dine-in POS, Takeaway

**What was built:**
- `src/lib/pos.db.ts` — Dexie.js (IndexedDB) database with 3 tables: `menuSnapshot`, `floorSnapshot`, `offlineOrders`
- `src/hooks/useOnlineStatus.ts` — Listens to `window` online/offline events; returns live boolean
- `POSPage.tsx` — Full offline integration:
  - **Menu cache**: When online, categories + items (with modifiers) saved to IndexedDB. When offline, IndexedDB data used as fallback for the menu browser and quick order dialog
  - **Floor plan cache**: Overview (sections + tables) saved to IndexedDB. When offline, last known floor plan shown
  - **Offline order queue**: `placeOrderMutation` and `quickOrderMutation` save orders to `offlineOrders` IndexedDB table instead of calling the API when offline; shows "Order queued — will sync when back online" toast
  - **Auto-sync on reconnect**: On `isOnline` → true, checks for unsynced orders and POSTs them in sequence; shows sync progress toasts
  - **Offline banner**: Amber banner "Working offline — orders will sync when reconnected" shown at top of POS when disconnected
  - **Network-only guards**: Session open/close, bill request, payment, discount, table transfer all show "Requires internet connection" toast when attempted offline (these need server-side state; cart + order placement queue safely offline)

---

### 11. Custom domain for online ordering storefront
**Status:** 🔴 TODO
**Effort:** Medium
**Affects:** Online Ordering

**Problem:**
Restaurants want `orders.mypizzaplace.com`, not `mypizzaplace.restrocloud.site`. No custom domain mapping UI or infrastructure exists.

**What to build:**
- DNS CNAME setup guide in Settings → Online Store
- Custom domain field with verification flow
- Nginx/Cloudflare routing to correct restaurant slug

---

### 12. Menu photos missing for most items
**Status:** ✅ DONE
**Effort:** Small (UX improvement)
**Affects:** QR Table Ordering, Online Ordering

**What was built:**
- **Color gradient fallback** (all three ordering components): When `imageUrl` is null/empty, a deterministic color gradient (8 warm palettes, picked by summing char codes of the item name) + the item's first letter is shown instead of the generic 🍽️ emoji. Consistent per item — same item always gets the same color.
- `ItemCard.tsx` (QR + Online menu grid) — 80×80px gradient square with letter + plus button
- `ItemSheet.tsx` (Online ordering detail panel) — full-width `aspect-[4/3]` gradient header with large letter
- `ItemModal.tsx` (QR bottom-sheet detail) — added image/fallback area at top (previously had NO image area at all); 192px gradient strip with large letter
- **Dashboard prompt** (`ItemsPage.tsx`): Amber banner "X items have no photo — adding photos improves customer conversions" shown above the item list whenever any items lack `imageUrl`. Auto-hides when all items have photos.

---

## Summary Table

| # | Item | Priority | Effort | Status |
|---|------|----------|--------|--------|
| 1 | Audio alert for new QR/online orders | 🔴 P1 | Small | ✅ DONE |
| 2 | Pending orders inbox / filter | 🔴 P1 | Small | ✅ DONE |
| 3 | QR code URL config (points to ordering app) | 🔴 P1 | Small | ✅ DONE |
| 4 | Warn on zero-price items | 🔴 P1 | Tiny | ✅ DONE |
| 5 | Takeaway order-ready notification | 🟡 P2 | Medium | ✅ DONE |
| 6 | Table transfer in POS | 🟡 P2 | Medium | ✅ DONE |
| 7 | QR orders visible on table card in POS | 🟡 P2 | Medium | ✅ DONE |
| 8 | Payment gateway credentials UI | 🟡 P2 | Medium | ✅ DONE |
| 9 | Thermal printer support | 🟢 P3 | Large | TODO |
| 10 | Offline POS mode | 🟢 P3 | Very Large | ✅ DONE |
| 11 | Custom domain for online store | 🟢 P3 | Medium | TODO |
| 12 | Menu item photo fallbacks | 🟢 P3 | Small | ✅ DONE |
