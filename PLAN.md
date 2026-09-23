# Ship Asaan Fulfillment Management System — Master Implementation Plan

This plan organizes the complete build of the Ship Asaan Courier + Fulfillment system into distinct, modular phases. Each phase builds directly upon the proven, tested foundation of preceding phases, ensuring no mock data, no superficial placeholders, and complete physical traceability throughout.

---

## Architecture & Technology Stack Overview

- **Full-Stack Runtime:** Express.js API backend running with Vite + React 19 + TypeScript + Tailwind CSS (`tsx server.ts` in full-stack dev/production mode).
- **Database & Storage:** Relational PostgreSQL data model / SQLite compatibility layer for instant local zero-dependency testing and migration portability to Supabase / Neon / Cloud SQL.
- **Security & Authorization:** Session/Bearer token authentication, password hashing (Argon2/bcrypt-compatible scrypt/PBKDF2), cryptographic OTP generation, server-authoritative RBAC with privilege containment.
- **Physical Tracking & Scanning:** Code 128 & QR code generation, HTML5 camera-based scanner + hardware USB/Bluetooth barcode scanner input support.
- **Document & PDF Generation:** Client/server PDF generation for stock labels, warehouse picking sheets, and shipping labels.
- **Stateless / Targeted Revalidation:** Mutation-driven targeted query cache invalidation avoiding global polling or full-page refreshes.

---

## Phase Breakdown

### Phase 1: Ground Laying & Core Architecture Foundation
*Goal: Establish the full-stack server architecture, relational database persistence layer, security foundations, audit logging engine, and idempotent administrator bootstrap.*
- [x] 1.1 Full-stack server setup (`server.ts` with Express API routes + Vite dev middleware + static client serving).
- [x] 1.2 Relational database schema engine with migration runner and transactional execution.
- [x] 1.3 Core database tables: `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `audit_logs`, `system_settings`.
- [x] 1.4 Cryptographic security utilities: password hashing with salt, secure session token generation, OTP generator/hasher.
- [x] 1.5 Environment configuration validation (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_SECRET`, `SMTP_*`).
- [x] 1.6 Idempotent Admin Bootstrap: creates Administrator role with global permissions and default admin account if none exists.
- [x] 1.7 Server-authoritative audit logging service: records actor, action, target entity, metadata, and timestamps.
- [x] 1.8 Targeted client API client with mutation response handling and targeted invalidation primitives.

---

### Phase 2: Identity, RBAC & Customer / Employee Lifecycle
*Goal: Granular role-based access control, employee onboarding with profile completeness tracking, customer signup, KYC, and explicit staff approval.*
- [x] 2.1 Granular permission catalog definitions (Employees, Customers, Inventory, Warehouses, Fulfillment, Wallet, Roles, System).
- [x] 2.2 Server-side authorization middleware (`requirePermission`, privilege containment: managers cannot escalate beyond their own permissions).
- [x] 2.3 Authentication endpoints & screens: Login, OTP-based password reset, active session validation.
- [x] 2.4 Customer self-registration flow (Legal Name, Business Name, CNIC, Phone, Address) -> starts as `Pending Approval`.
- [x] 2.5 Customer approval & suspension workflow for authorized staff; customer pending portal view with transparent explanation.
- [x] 2.6 Tenant isolation middleware: strict scoping so customers can only access their own records.
- [x] 2.7 Employee management: creation (personal, employment, joining date calendar picker, role assignment).
- [x] 2.8 Modular Profile Completion model (Basic details, Contact, CV, CNIC, Bank documentation) with visual incompleteness indicators.
- [x] 2.9 Custom roles creation and permission assignment interface.

---

### Phase 3: Customer Wallet & Financial Ledger
*Goal: Authoritative financial tracking with immutable ledger entries, manual top-ups, debit capability, and customer balance views.*
- [x] 3.1 Relational schema: `wallet_accounts` (customer_id, balance, currency, status) and `wallet_transactions` (CREDIT, DEBIT, ADJUSTMENT, REVERSAL).
- [x] 3.2 Atomic database transaction functions for balance mutation (concurrency-safe, preventing double-credits or lost updates).
- [x] 3.3 Staff Manual Top-up interface: Add funds with payment reference number, date, and notes.
- [x] 3.4 Staff Manual Debit / Adjustment interface with mandatory reason logging.
- [x] 3.5 Customer wallet portal: Live balance display, deposit instructions, ledger history, date filtering.
- [x] 3.6 Ledger export (CSV) and full audit integration.

---

### Phase 4: Warehouse Infrastructure & Flexible Location Hierarchy
*Goal: Model physical warehouses with recursive parent-child locations, reusable storage templates, capacity tracking, and printable labels.*
- [ ] 4.1 Schema: `warehouses`, `locations` (flexible tree with parent_id, path, type, dimensions, capacity_volume, max_units), `storage_templates`.
- [ ] 4.2 Flexible location tree builder: Warehouse -> Hall -> Room -> Rack -> Shelf -> Bin -> Cell (or custom hierarchical depths).
- [ ] 4.3 Storage template engine: Predefined rack/shelf/bin dimension templates vs custom storage structures.
- [ ] 4.4 Capacity tracking engine: Dimensions (LxWxH), calculated volume, unit capacity, occupied volume/units, utilization indicators.
- [ ] 4.5 Location identifier generator (e.g., `WH01-RK-A-BN-04`) with printable Barcode (Code 128) and QR code sheet generation.
- [ ] 4.6 Interactive location browser & management UI with real-time occupancy stats.

---

### Phase 5: Products, Physical Inventory Units & Stock Receiving / Scan-to-Place
*Goal: Explicit physical inventory tracking where each received unit has a unique identity, printed label, and scan-verified location placement.*
- [ ] 5.1 Schema: `products` (SKU, name, dimensions, weight, customer_id, low_stock_threshold), `inventory_units` (tracking_code, product_id, customer_id, location_id, state), `inventory_transactions` ledger.
- [ ] 5.2 Stock receiving workflow: SKU selection or creation -> quantity entry -> batch creation of individual `inventory_units` (e.g., `UNIT-A8F3`).
- [ ] 5.3 Stock label PDF generation: Printable Code 128 barcodes + QR codes for each physical inventory unit.
- [ ] 5.4 Interactive Stocking Session:
  - Select/scan destination location.
  - Scan item labels to place into storage (hardware USB scanner keyboard wedge + device camera support).
  - Validation: correct customer, eligible unit, no double-stocking, location capacity check.
  - In-session instant location switching.
- [ ] 5.5 Inventory transaction ledger: records `RECEIVE`, `STOCK`, `MOVE`, `ADJUST` events with actor and timestamps.
- [ ] 5.6 Inventory operational table: Search (SKU, title, client, location, unit code), multi-attribute filters, low-stock alerts, customer isolation.

---

### Phase 6: Fulfill Order Lifecycle & CSV Import Engine
*Goal: End-to-end fulfillment order intake, customer self-service, staff proxy creation, bulk CSV validation, and explicit confirmation queue.*
- [ ] 6.1 Schema: `fulfillment_orders` (order_number, customer_id, consignee details, COD amount, status), `fulfillment_order_items` with SKU snapshots.
- [ ] 6.2 Manual Order Creation: Customer creation (auto-scoped) vs Staff creation (select customer), consignee inputs, multi-line item selector.
- [ ] 6.3 Multi-step CSV Order Import:
  - File upload -> Parse -> Table preview -> Rigorous validation (headers, SKU existence, quantities, COD, phone format) -> Commit.
  - Granular error reporting per row and column with correction hints.
- [ ] 6.4 Order status state machine: `Placed` -> `Confirmed` -> `To Fulfill` -> `Picked` -> `Packed` -> `Fulfilled/Shipped` -> `Cancelled`.
- [ ] 6.5 Customer order confirmation queue: Staff review & explicit confirmation action (no automatic confirmation).
- [ ] 6.6 Customer order tracking view with customer-safe operational status transitions.

---

### Phase 7: Warehouse Fulfillment, Picking Sessions, PDF Generation & Scan-to-Pack
*Goal: Controlled physical order fulfillment: inventory reservation, scan-out picking, picking PDFs, shipping labels, and mandatory scan-to-pack station.*
- [ ] 7.1 "To Fulfill" queue: Bulk selection of confirmed orders -> `Prepare Fulfillment`.
- [ ] 7.2 Stock allocation & reservation: Deterministic reservation of physical `inventory_units` preventing double-allocation.
- [ ] 7.3 Warehouse Picking Session:
  - Operator guided picking by location.
  - Scan-out item verification: checks SKU, customer, active order association.
  - Incorrect pick protection (wrong item, wrong client, already picked).
  - Physical unit moves from `In Storage` -> `Picked`.
- [ ] 7.4 Warehouse Picking Sheet PDF: Printable fulfillment summary matching selected orders exactly.
- [ ] 7.5 Shipping / Order Label PDF: Printable labels with consignee info, COD, customer ref, and machine-readable Order Barcode/QR.
- [ ] 7.6 **Packing Station (Scan-to-Pack)**:
  - Scanning package/order label is **MANDATORY** to achieve `Packed` state (label printing alone does not pack).
  - Validates all items picked and associated.
  - Updates order to `Packed` and inventory units to `Packed`.
- [ ] 7.7 Eventual dispatch transition to `Fulfilled/Shipped`.

---

### Phase 8: Operational Dashboards, Documents, Export Engine & System Polish
*Goal: Authentic zero-baseline dashboards, secure document handling, comprehensive data exports, responsive design, and audit log viewer.*
- [ ] 8.1 Operational dashboards: Real counts for pending customer approvals, incomplete employees, orders to confirm, to fulfill, to pack, low stock (genuine zero state when empty).
- [ ] 8.2 Customer dashboard: Real-time wallet balance, recent ledger transactions, active orders.
- [ ] 8.3 Document management: Controlled uploads and signed/proxied retrieval for employee CVs, CNIC, and customer KYC files.
- [ ] 8.4 Operational Export engine: Filter-aware CSV exports for Orders, Inventory, and Wallet ledger.
- [ ] 8.5 Responsive layout tuning: Optimized for handheld warehouse tablets and mobile camera scanning.
- [ ] 8.6 System audit trail viewer: Filterable audit log of all system mutations.

---

## Current Status & Next Immediate Action

- **Current Stage:** Planning complete. Master plan and progress log created. Project vision preserved.
- **Next Phase Proposed:** **Phase 1: Ground Laying & Core Architecture Foundation**.
- *Awaiting user approval before starting Phase 1 implementation.*
