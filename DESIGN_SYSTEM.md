# Ship Asaan Fulfillment Management System — Visual Design System

This document establishes the authoritative visual design guidelines, tokens, component contracts, and UI patterns for Ship Asaan across all phases.

---

## 1. Design Philosophy & Aesthetic Direction
- **Identity**: A modern, high-precision logistics and fulfillment management platform (inspired by world-class systems like Flexport, ShipBob, and Linear).
- **Tone**: Clean, operational, calm, confident, and professional. Designed for intensive daily warehouse floor and administrative use without visual fatigue.
- **Anti-Slop Restraint**:
  - No pitch-black hacker consoles or artificial terminal typography.
  - No decorative status tickers, fake background thread counters, or low-opacity watermark text.
  - No neon cyan/magenta glows or floating glossy 3D pastel bubbles.
  - No static pill badge sandwiches.

---

## 2. Surfaces, Canvas & Color Distribution (60-30-10 Rule)
- **Primary Canvas (60%)**: Calming neutral off-white/light-slate (`#F8FAFC` / `bg-slate-50`).
- **Structural Surfaces (30%)**: Pure white content cards (`#FFFFFF` / `bg-white`) with single-elevation depth, hairline borders (`border border-slate-200/90`), and subtle shadows (`shadow-xs`).
  - *No nesting cards within cards*. Separate hierarchical content using whitespace margins and hairline dividers (`border-slate-100`).
- **Accent Budget (10%)**: Deep rich forest emerald (`#047857` / `bg-emerald-700`, hover `#065F46` / `bg-emerald-800`).
  - Dark secondary accent: Authoritative slate-900 (`#0F172A`).

---

## 3. Typography Hierarchy & Tabular Discipline
- **Display & Headings**: `Plus Jakarta Sans`, 600 SemiBold / 700 Bold, tracking tight (`tracking-tight`).
  - Display 1: `text-2xl font-bold text-slate-900`
  - Section Heading 2: `text-base font-semibold text-slate-900`
  - Card/Panel Title: `text-sm sm:text-base font-semibold text-slate-900`
- **Body Prose**: `Plus Jakarta Sans`, 400 Regular / 500 Medium.
  - Primary Body: `text-xs sm:text-sm text-slate-700 leading-relaxed`
  - Secondary/Metadata: `text-xs text-slate-500`
  - Micro-labels: `text-[11px] font-semibold text-slate-500 uppercase tracking-wider`
- **Data & Numeric Discipline (Mandatory Tabular Numerals)**:
  - All inventory quantities, SKU codes, tracking numbers, warehouse rack coordinates, monetary figures (PKR), and timestamps must use `font-mono tabular-nums` (`JetBrains Mono`).

---

## 4. Component Standards

### A. Buttons & Interactive Controls (`src/components/ui/Button.tsx`)
- Standard heights: Small `h-8` (`text-xs px-2.5 py-1.5`), Medium `h-9` (`text-sm px-3.5 py-2`), Large `h-10` (`text-sm px-4.5 py-2.5`).
- Variants:
  - `primary`: Emerald background, white text, subtle shadow (`bg-emerald-700 hover:bg-emerald-800 text-white`).
  - `secondary`: Dark slate background (`bg-slate-900 hover:bg-slate-800 text-white`).
  - `outline`: White background, slate border, dark text (`bg-white border-slate-300 text-slate-700 hover:bg-slate-50`).
  - `ghost`: Transparent with subtle hover highlight (`hover:bg-slate-100 text-slate-600`).
  - `danger`: Red action for destructive operations (`bg-rose-600 hover:bg-rose-700 text-white`).
- Integrated loading state (`Loader2` spinner), disabled opacity, active micro-compression (`active:scale-[0.99]`).

### B. Form Inputs (`src/components/ui/Input.tsx`, `Select.tsx`)
- Crisp white surface, border `#CBD5E1` (`border-slate-300`), focus ring in subtle emerald (`focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30`).
- Clear label typography (`text-xs font-semibold text-slate-700 mb-1.5`), required asterisks, helper text, and high-visibility error messages.

### C. Status Badges & Tokens (`src/components/ui/Badge.tsx`)
- Strict Zero-Pill adherence: Clean rectangular geometry with soft rounded corners (`rounded`), subtle borders, and WCAG AA contrast.
- Semantic pairs:
  - `success`: `bg-emerald-50 text-emerald-800 border-emerald-200/80` (with optional green dot).
  - `warning`: `bg-amber-50 text-amber-800 border-amber-200/80` (with optional amber dot).
  - `danger`: `bg-rose-50 text-rose-800 border-rose-200/80` (with optional red dot).
  - `info`: `bg-sky-50 text-sky-800 border-sky-200/80`.
  - `neutral`: `bg-slate-100 text-slate-700 border-slate-200/80`.

### D. Data Tables (`src/components/ui/Table.tsx`)
- High-density data grid with compact row padding (`px-4 py-3`), uppercase headers (`text-[11px] font-semibold text-slate-600 bg-slate-50/90`), subtle row hover highlights (`hover:bg-slate-50/80`), and right alignment for all numeric columns.

### E. Modals & Dialogs (`src/components/ui/Modal.tsx`)
- Fixed centered modal with subtle backdrop blur (`bg-slate-900/50 backdrop-blur-xs`), keyboard `Escape` event listener, clean header with title/description, dismiss cross button, and sticky action footer.

### F. Empty & Loading States (`src/components/ui/EmptyState.tsx`, `Skeleton.tsx`)
- Empty state: Clean slate-100 container for domain icon, crisp title, explanatory copy, and explicit action button (e.g., "Create Inbound Batch").
- Skeletons: Geometry-aligned animated pulse matching card and row heights ($\le 2\text{px}$ delta).

### G. Top Bar & Navigation Layout (`src/components/layout/AppLayout.tsx`)
- Strict 3-zone contract:
  - Zone 1: Single text element brand wordmark: `Ship Asaan`.
  - Zone 2: Contextual breadcrumbs (`Operations / Infrastructure & Nodes`).
  - Zone 3: User identity trigger & Sign Out.
- Responsive, collapsible sidebar ($256\text{px}$) with crisp icon navigation and clear active indicators.
