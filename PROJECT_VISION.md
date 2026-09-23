# Ship Asaan Fulfillment Management System
## Detailed Product, UX, Data, Security and Engineering Specification

## 1. Product Definition

Build a production-oriented full-stack web application for **Ship Asaan Courier + Fulfillment**.

The product is an internal and client-facing fulfillment management system combining:

* A lightweight warehouse management system.
* A 3PL/fulfillment operations system.
* A customer/client portal.
* Employee management and onboarding.
* Configurable role-based access control.
* Inventory and physical warehouse tracking.
* Fulfillment order management.
* CSV import/export.
* Manual customer wallet management.
* Barcode/QR-driven warehouse workflows.
* Printable fulfillment and shipping documentation.

This is an operational business application, not a generic dashboard CRUD demo.

The application will hold real customer, employee, inventory, order, document and financial-balance information. Correctness, traceability, permission enforcement and operational usability therefore take priority over decorative UI.

The application should feel like a serious professional logistics/WMS product.

Do not implement specified functionality as superficial placeholder screens.

---

# 2. Core Product Principles

### Data is authoritative

There must be a single authoritative source of truth for:

* Users.
* Employees.
* Customers.
* Roles.
* Permissions.
* Warehouses.
* Physical locations.
* Storage structures.
* Products/SKUs.
* Physical inventory units.
* Inventory transactions.
* Fulfillment orders.
* Order items.
* Customer wallet balances and ledger entries.
* Documents.
* Notifications.
* Audit history.

### Backend authorization is authoritative

Frontend visibility is not security.

Every protected operation must be authorized server-side.

A user must not gain access by:

* Modifying a request.
* Changing a client-side value.
* Changing a URL parameter.
* Supplying another user's ID.
* Calling an API endpoint directly.
* Editing browser state.
* Manipulating hidden UI controls.

### Operational records should be durable

Do not casually delete:

* Inventory.
* Inventory movements.
* Orders.
* Financial ledger entries.
* Audit history.

Prefer:

* Active/inactive.
* Archived.
* Cancelled.
* Voided.
* Reversed.

where appropriate.

### No fake production data

Do not create:

* Sample customers.
* Sample employees.
* Fake warehouses.
* Fake storage locations.
* Fake products.
* Fake SKUs.
* Fake inventory.
* Fake orders.
* Fake wallet balances.
* Fake transactions.
* Fake dashboard statistics.

Production must genuinely start empty except for the intentionally configured administrator account.

---

# 3. Deployment and Architecture

The application should be built as a modern full-stack web application.

Preferred technology direction:

* Next.js / Express + React SPA.
* TypeScript.
* PostgreSQL.
* Secure authentication.
* Object storage for images/documents.
* Server-side business logic.
* Strong RBAC.
* Database transactions and constraints.

The initial deployment target is **Vercel** (with portable architecture for alternative servers/containers).

Do not unnecessarily couple business logic to platform-specific functionality.

The architecture should remain portable enough that deployment can later move to another serverless platform or container if needed.

The database should also remain portable.

---

# 4. Database Direction

The system is relational.

Entities such as:

* customer → products
* product → inventory
* inventory unit → location
* order → order items
* order item → SKU
* employee → role
* role → permissions
* customer → wallet
* wallet → transactions

are naturally related.

Use a relational database such as PostgreSQL rather than forcing the application into a key-value model.

---

# 5. Stateless/Serverless Refresh Strategy

The application must be designed with the reality of serverless/stateless deployment in mind.

Do NOT solve data freshness by aggressively polling everything.

Avoid:
* Global 1-second polling.
* Full-page refresh loops.
* Re-fetching the entire database after a small mutation.
* Re-rendering every application component when one value changes.

Updates should be deliberate, targeted, quiet and nearly unnoticeable to the user.

When a mutation occurs:
1. The backend performs the authoritative database transaction.
2. The response returns the newly authoritative affected data where practical.
3. Only the affected client-side query/cache/route segment is invalidated.
4. Only dependent information is re-fetched.
5. Unrelated components remain untouched.
6. The user does not see a visible flash/reload unless the operation genuinely requires it.

---

# 6. Authentication

When the application URL is opened, the user initially encounters a professional authentication screen.

Support:
* Login (Email, Password, Login action, Forgot password, Signup where appropriate).
* Forgot password (Secure OTP process, cryptographically secure OTP, hashed storage, short expiration, SMTP delivery, rate limiting).

---

# 7. Email / SMTP

Configurable SMTP (Google Workspace / Gmail SMTP supported).
Environment variables: SMTP host, port, user, pass, sender address/name.
Templates: Password reset, customer signup, customer approval, employee onboarding/invite, profile completion reminders, order status changes, etc.

---

# 8. Roles and Permissions

Configurable RBAC:
* Administrator
* Manager
* Employee
* Customer
* Custom Roles

Granular permissions for Employees, Customers, Inventory, Warehouses, Fulfillment, Wallet, Roles, System.

---

# 9. Privilege Containment

Managers can create employees only within the permissions granted to their own role. No permission escalation. Backend enforcement.

---

# 10. Administrator Bootstrap

Idempotent bootstrap via environment configuration (ADMIN_EMAIL, ADMIN_PASSWORD). Creates protected administrator role & account if none exists.

---

# 11-14. Customer Lifecycle & Isolation

* Signup with legal/business KYC (Account Status = Pending Approval).
* Explicit approval workflow by authorized staff.
* Pending customers can still log in and view permitted info with clear "Pending Approval" / "KYC Incomplete" status.
* Multi-tenant isolation: customers can only access their own data. Server-side enforced.

---

# 15-19. Employee Lifecycle & Profile Completion

* Creation with personal, employment, and account details.
* "Complete now or later" verification flow.
* Prominent visual warning for incomplete profiles.
* Secure document uploads (CV, CNIC, Bank info).
* Clear requirement-based completion model.

---

# 20-26. Warehouse Management & Flexible Location Hierarchy

* Warehouse metadata and capacity.
* Flexible parent-child location tree (Warehouse → Hall → Room → Rack → Shelf → Bin → Cell, etc.).
* Reusable storage templates (Rack, Bin, Shelf, Cell) vs custom structures.
* Unique internal location identifier & printable Barcode/QR labels (e.g. WH01-RK-A-BN-04).
* Capacity model (dimensions, calculated volume, max quantity, current occupied, available).
* **NO AUTO-SORT**: Physical placement of stock must be explicit scan-to-place.

---

# 27-38. Products, SKUs & Physical Inventory Units

* Separate Product/SKU definitions from physical inventory units and inventory transactions.
* Every received physical unit has an individual inventory unit identity with a unique tracking code (e.g. UNIT-A8F3).
* Receiving workflow: Select/create SKU → enter quantity → create inventory units → generate printable PDF labels (Code 128 / QR) → physically label items.
* Stocking session: Select/scan location → scan item labels → validate customer, unit state, location capacity → associate unit with location.
* In-session location switching without leaving workflow.
* Protection against duplicate scans, cross-customer mixing, capacity overflow, and invalid barcodes.
* Hardware scanner (keyboard emulation) and device camera support.
* Inventory lifecycle: Awaiting Stocking, In Storage, Reserved, Picked, At Packing, Packed, Fulfilled, Returned, Damaged, Lost.
* Immutable inventory transaction ledger (RECEIVE, STOCK, MOVE, RESERVE, PICK, PACK, FULFILL, RETURN, DAMAGE, LOSS, ADJUSTMENT).
* Distinguish on-hand, available, reserved, picked, packed, damaged. Configurable low-stock thresholds.

---

# 39-42. Customer Inventory & Table Views

* Customer inventory view restricted to own items (no move/stock unless explicitly granted by custom role).
* Operational tables with search, filter, sort, pagination, column visibility, CSV/PDF export.

---

# 43-48. Customer Wallet

* Manually maintained operational balance with Ship Asaan (no auto-gateway required initially).
* Wallet account + immutable wallet ledger (CREDIT, DEBIT, ADJUSTMENT, REVERSAL).
* Concurrency-safe, transactional, auditable balance adjustments.
* Customer wallet view with balance, status, transaction history, deposit instructions.

---

# 49-57. Fulfill Orders

* Terminology: "Fulfill Order".
* Comprehensive order model: ID, order number, customer, consignee, COD, line items with SKU snapshots.
* Customer order creation starts "Placed / Pending Confirmation".
* Authorized employee order creation on behalf of clients.
* CSV Order Import with upload, parse, preview, validate, commit steps.
* Explicit confirmation workflow by authorized staff before entering "To Fulfill" queue.

---

# 58-68. Picking, Packing & Scan-Driven Physical Truth

* Prepare fulfillment session for selected orders.
* Stock allocation and reservation of physical inventory units.
* Picking workflow: scan item labels out of storage into Picked state.
* Incorrect pick protection (wrong SKU, wrong customer, already picked).
* Warehouse picking PDF sheet generation.
* Shipping label PDF generation with machine-readable order barcodes/QRs.
* **Packed state MUST require a scan**: generating labels does not mark packed. Scanning package label at packing station verifies and marks Packed.
* Direct link between order and exact physical inventory units fulfilled.

---

# 69-70. Returns, Future States & Order Export

* Ledger prepared for future return/reversal flows.
* Multi-criteria CSV export for orders.

---

# 71-76. Operational Dashboard, Navigation & Tables

* Operational dashboards showing real queues and status counts (no manufactured or fake numbers).
* Customer dashboard with live wallet and order state.
* Permission-aware navigation.
* Consistent operational table pattern across all modules with bulk actions.

---

# 77-86. Real-Time, Performance, Concurrency & Audit

* Targeted cache invalidation without full-page reloads.
* High freshness for wallet and fulfillment queues.
* Concurrency safety for wallet ledger and inventory unit allocation.
* Comprehensive audit logging for all mutations.
* Empty production environment at launch (only bootstrap admin).

---

# 87-117. Engineering Standards & Quality Bar

* Strict separation of models.
* Real scan-driven physical truth in warehouse operations.
* Incremental development discipline maintained via PLAN.md and PROGRESS.md.
