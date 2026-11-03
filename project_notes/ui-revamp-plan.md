# Invoice Parser — UI/UX Revamp Plan

Status: PLAN ONLY (nothing implemented). Written 2026-11-03.
Scope: visual + interaction redesign of the dashboard. Data layer (`lib/storage.ts`, `lib/parseInvoice.ts`, `lib/supabase.ts`, `app/api/parse`, Supabase schema) is **not** changed by this plan unless listed under the optional last phase.

Inputs used: full read of `app/page.tsx` (2,755 lines), `components/*`, `app/layout.tsx`, `app/globals.css`, `package.json`, `lib/storage.ts`, `lib/parseInvoice.ts` (types + type detection), `data/invoices.json` (26 invoices, to check real descriptions/units), and the `ui-ux-pro-max` skill data (style, colour, typography, chart, UX and stack searches — see §2.0).

---

## 0. One-page summary

- **Problem:** one 2,755-line scrolling page with 35 `useState`s, ~19 near-identical charts hidden behind six cryptic toggle buttons, invoice detail rendered above the toolbar, a date-range filter that has state and logic but no control, KPI numbers that disagree with the charts for the combined rent+parking invoice, no keyboard/screen-reader support (zero `aria-*`/`role` in the app), US-style number formats for a PLN app.
- **Direction ("Calm Ledger"):** neutral, quiet chrome; colour is reserved for data (Rent / Parking / Utility / Other). Data-dense dashboard style, comfortable-compact density, Fira Sans + Fira Code, light/dark/system theme, tabular numbers, Polish money formatting.
- **IA:** app shell with 4 destinations — **Overview**, **Invoices**, **Analytics** (Monthly costs · Utilities · Year over year), **Data** (manual heating values, import/export, sync, settings, danger zone). Upload is a global action (button + drop anywhere). Invoice detail is a right-hand **drawer** (bottom sheet on phones).
- **Charts:** ~19 charts → 3 chart types (stacked bars, small bar multiples, year lines) used in 3 places (Overview, Analytics tabs). **Every chart and every data table is wrapped in one shared `ChartCard` / `DataPanel` with the same toolbar** (Chart | Table switch, Bar | Line | Area switch with a ≥ 4-point rule, true full-screen, Export → PNG / CSV / PDF), plus a page-level **Report (PDF)** for Overview and each Analytics tab (§4.11, §4.12).
- **PDF:** recommended approach = print pipeline (hidden light-themed `#print-root` + `window.print()` → "Save as PDF"): zero dependencies, vector Recharts SVG, Polish glyphs via the already-loaded Fira Sans, real table pagination. PNG = SVG → canvas with embedded font. CSV = shared generator.
- **Buttons & controls (new, §2.7):** today's 33 buttons use 8 size recipes, 3 radii and 10 colour families, five fail contrast, seven icon-only ones have no name, and none has a focus style. Replaced by one `Button` family (primary / secondary / ghost / destructive / destructive-quiet / link / icon-only; sm 32 · md 40 · lg 48 px; 10 px radius), plus `SegmentedControl`, `Tabs`, `ToggleChip`, `MenuButton`, `Input`/`Select`/`Checkbox`, `Tooltip`. Rules: one primary per surface, disabled always gives a reason, labelled buttons everywhere (short allowed list for icon-only), destructive actions kept away from Save, narrow screens overflow into a labelled "More" menu. A before/after table maps every current button (§2.7.10). A dev-only `/dev/ui` gallery shows every variant/size/state in light and dark and **must be reviewed before Phase 2 starts**; every later phase ships light/dark screenshots at 375 and 1440 px.
- **Build:** strangler approach — 11 redesign phases (0–10) + **Phase 3.5 (shared data-view toolbar, full-screen, export)** + 1 optional storage-hardening phase (11), each shippable; Phase 0 adds no visuals and locks current numbers with tests so the refactor cannot silently change totals.
- **New dependencies:** `lucide-react` (icons), `vitest` (dev). Everything else is built-in (`next/font`, native `<dialog>`, Tailwind v4 `@theme`, existing `recharts`, browser print, Canvas). **No PDF library** in v1 (comparison and upgrade path in §4.12).

---

## 1. Current-state audit

### 1.1 Stack facts

| Item | Value |
|---|---|
| Framework | Next.js `^14.2.35` (App Router), React `^18.3.1` (note: `@types/react` is `^19.2.7` — mismatch, harmless today, keep in mind) |
| Styling | Tailwind CSS `^4.1.18` via `@tailwindcss/postcss`; **no `tailwind.config`** (v4 CSS-first). `app/globals.css` has `@import "tailwindcss"` + `@custom-variant dark (&:where(.dark, .dark *))` (class-based dark mode) |
| Charts | `recharts ^3.6.0` (only `BarChart`, `Bar`, axes, `Tooltip`, `Legend`, `ResponsiveContainer` used) |
| Data | Supabase (anon key in browser) — tables `invoiceparser_invoices`, `invoiceparser_line_items`, `invoiceparser_manual_values` |
| Fonts | None loaded; system stack in `globals.css:6` |
| Icons | 33 hand-pasted inline `<svg>` blocks in `page.tsx` + more in `Toast.tsx` |
| Dates | Strings, `DD/MM/YYYY` (`parseInvoice.ts` normalises to this). Month keys are `"Mon YYYY"` English (e.g. `"Nov 2025"`) and are also the primary key of manual values (`month_key`) |
| Currency | PLN; formatted with `en-US` locale everywhere |

### 1.2 Feature inventory (nothing may be lost)

"New home" refers to screens defined in §3–§4. `F#` IDs are used by the phase acceptance criteria in §7.

**Upload & parsing**

| ID | Feature (current behaviour) | Where today | New home |
|---|---|---|---|
| F1 | Drag-drop or click to pick PDFs, multiple files | `FileUpload.tsx:10-98`; `page.tsx:1222` (always on top of page) | Global Upload dialog + window-wide drop target |
| F2 | Non-PDF files silently dropped | `FileUpload.tsx:27-29, 39-41` | Shown in queue as "Skipped — not a PDF" |
| F3 | POST all files to `/api/parse`, get per-file `invoice \| error` | `page.tsx:675-700` | Upload dialog (same endpoint) |
| F4 | Duplicate detection by `invoiceNumber + issueDate` (vs existing and within batch) | `page.tsx:703-724` | Upload dialog queue row "Duplicate — skipped" |
| F5 | Parse-failure list + error toast | `page.tsx:1233-1253, 751-753` | Queue row "Failed" + persistent error toast |
| F6 | Save each new invoice to Supabase, then prepend to list; toast count; toast on save error | `page.tsx:734-746` | Same logic, moved to `useUploader` |
| F7 | Global error banner (request failed) | `page.tsx:1226-1231` | Dialog-level banner |

**Invoice list**

| ID | Feature | Where today | New home |
|---|---|---|---|
| F8 | Table: invoice number + filename, month name (no year), type badge, gross amount + currency, row actions | `page.tsx:2006-2149` | Invoices → table (cards on phones) |
| F9 | Sort by invoice / date / type / amount, asc/desc (default unsorted = `parsed_at` desc from DB) | `page.tsx:591-598, 2012-2055` | Invoices → sortable headers (default Issued ↓) |
| F10 | Click row to open/toggle detail | `page.tsx:2067-2072` | Row opens drawer |
| F11 | Collapse table body | `page.tsx:1985, 2005` | Dropped (not needed once list is its own screen) — see §4.3 note |
| F12 | "Table" on/off toggle in filter bar | `page.tsx:1809-1814` | Dropped (list is always visible on Invoices) |
| F13 | Inline edit of type, net, tax, gross (linked: net/tax edit → gross = net+tax; gross edit → tax = max(0, gross−net); save blocked if \|gross − (net+tax)\| > 0.01) | `page.tsx:805-869, 2151-2260` | Drawer → Edit mode |
| F14 | Delete one invoice: optimistic remove, rollback on error, 10-level undo stack | `page.tsx:763-786` | Row menu / drawer → toast with real Undo button |
| F15 | "Clear" = delete all (window.confirm) | `page.tsx:871-890, 1738-1747` | Data → Danger zone (dialog confirm) |
| F16 | Undo (toolbar button when stack non-empty, and Cmd/Ctrl+Z) | `page.tsx:788-803, 917-928, 1726-1737` | Toast Undo + Cmd/Ctrl+Z (not while typing) |
| F17 | Compare two invoices: totals net/tax/gross with diff and %, line items matched by description with gross/unit-price/qty diffs, "Not in this invoice" rows | `page.tsx:1335-1559`, selection `1679-1721, 2081-2104` | Invoices → checkboxes + Compare dialog |
| F18 | Keyboard: ↑/↓ moves selected invoice, Esc closes detail, Cmd/Ctrl+F focuses search | `page.tsx:893-940` | Row roving focus when table focused; Prev/Next in drawer; `/` focuses search; Esc closes drawer |

**Filters**

| ID | Feature | Where today | New home |
|---|---|---|---|
| F19 | Search by invoice number or filename | `page.tsx:529-532, 1758-1769` | Invoices filter bar |
| F20 | Type filter with counts | `page.tsx:1772-1781` | Type chips with counts |
| F21 | Month filter ("Mon YYYY") with counts | `page.tsx:1784-1793` | Folded into Period control (From = To = month) |
| F22 | Date range (YYYY-MM start/end): applied + saved, **but no UI control exists** | `page.tsx:534-554`; setters only at `144-145, 1159-1160` | Period control (From / To) |
| F23 | Clear filters | `page.tsx:1155-1161, 1796-1803, 2268-2277` | Active-filter chips + "Clear all" |
| F24 | Filters persisted in `localStorage['invoice-parser-filters']` | `page.tsx:136-168` | Same key, same shape (+ migration for `filterMonth`) |

**Summary / KPIs**

| ID | Feature | Where today | New home |
|---|---|---|---|
| F25 | 6 cards: total invoice count + sum; YTD count + sum; per-type count/sum/avg | `page.tsx:1851-1943` | Overview KPI row; Invoices result strip (count + sum) |
| F26 | Monthly sums (collapsible) | `page.tsx:1944-1974` | Overview "Monthly costs" chart + table view |
| F27 | Running totals computed but never rendered | `page.tsx:613-621` | Not carried over (dead code) |

**Invoice detail**

| ID | Feature | Where today | New home |
|---|---|---|---|
| F28 | Header (number, filename, gross), issue date, line items, net/tax/gross totals | `InvoiceCard.tsx:21-85`, shown at page top `page.tsx:1256-1332` | Invoice drawer |
| F29 | Line items table (#, description, qty+unit, unit price, net, tax, gross); Central Heating row highlighted/"(adjusted)" when manual value set; extra "Manual Heating Calculation (N × 76)" row unless already stored | `LineItemTable.tsx:11-122` | Drawer → line items (compact + full-columns toggle) |
| F30 | Manual value editor for Utility invoices, keyed by invoice month; shows "N × 76 = X"; add/edit/save/cancel; Enter saves, Esc cancels; saved via `saveManualValues` | `page.tsx:1163-1185, 1271-1324` | Drawer card (Utility only) **and** Data → Manual heating values table |
| F28b | Parsed but never shown: sale date, due date, seller (name/address/NIP), purchaser, payment method, bank account | parsed in `parseInvoice.ts:22-36`, stored in `storage.ts:16-60` | Drawer → "Dates & payment", "Parties" (new, read-only) |

**Charts** (all use `invoices`, ignore search/date range; hidden when type or month filter ≠ all — `page.tsx:2283, 2461, 2530, 2591`)

| ID | Feature | Where today | New home |
|---|---|---|---|
| F31 | Button labelled "Cumulative" (really: monthly Rent, Utility, Parking bar charts — 3 charts) | `page.tsx:1815-1820, 2282-2458` | Analytics → Monthly costs (stacked + "Separate scales") ; Overview monthly chart |
| F32 | "Gross": 5 utility sub-type gross-per-month charts | `page.tsx:2460-2527` | Analytics → Utilities → Cost |
| F33 | "Qty": 5 charts (sum of quantity per month) | `page.tsx:2529-2588` | Analytics → Utilities → Usage |
| F34 | "Unit Price": 5 charts (avg of gross/qty per line, per month) | `page.tsx:2590-2651` | Analytics → Utilities → Unit price |
| F35 | "YoY": utility gross by month, one bar per year | `page.tsx:2653-2728` | Analytics → Year over year |
| F36 | Combined rent+parking split by line item (`amountsByType`) | `page.tsx:72-86` | `lib/analytics.ts` — used by **all** KPIs and charts |
| F37 | Manual-heating rows excluded from utility charts | `page.tsx:389-391` etc. | Same rule in `lib/categories.ts` |

**Data, system, misc**

| ID | Feature | Where today | New home |
|---|---|---|---|
| F38 | Import JSON (upserts each invoice, merges into state) | `page.tsx:1019-1050` | Data → Import (with preview) |
| F39 | Export JSON (manual adjustments applied) | `page.tsx:1052-1065` | Invoices → Export menu; Data → Export |
| F40 | Export CSV (filtered list, adjustments applied, BOM) | `page.tsx:1067-1101` | Same |
| F41 | Export "Excel" (a CSV saved as `.xls`) | `page.tsx:1103-1138` | Same (decision: keep, relabelled "Excel-compatible (.xls)"; see §9 decisions) |
| F42 | Print (`window.print()` + print CSS) | `page.tsx:1140`, `globals.css:42-105` | Invoices header + Data page (plain page print, new print stylesheet). Separate from the new **PDF export** (F53–F54), which prints a purpose-built light report, not the live page. |
| F43 | "Save Session" (re-saves manual values; toast "synced") | `page.tsx:1144-1153, 1597-1605` | Data → Sync: "Save manual values now" |
| F44 | Dark mode toggle, persisted `localStorage['invoice-parser-dark-mode']` | `page.tsx:136-179, 1197-1211` | Theme control (system/light/dark); old key migrated |
| F45 | Toasts: success/error/info/warning, 3 s default, click to dismiss | `Toast.tsx`, `page.tsx:125-133, 1215` | New ToastProvider |
| F46 | Empty state, "no matches" state | `page.tsx:2268-2278, 2731-2749` | Redesigned (§4) |
| F47 | Error boundary page | `app/error.tsx` | Restyled, same behaviour |
| F48 | Initial load of invoices + manual values from Supabase (failure ⇒ empty list, only `console.error`) | `page.tsx:182-204`, `storage.ts:97-100` | `InvoicesProvider`; failure becomes a visible error state with Retry |

**New requirements (added 2026-11-03, round 2) — shared data-view toolbar and export.** These did not exist before; they apply to *every* chart and data table.

| ID | Feature | Where it lives |
|---|---|---|
| F49 | **Chart \| Table view switch** on every chart (always visible, text-labelled) and, where a time-series chart counterpart exists, on every data table ("show as chart") | `ChartCard` / `DataPanel` → `ChartToolbar` / `ViewSwitch` (§4.11) |
| F50 | **Chart-type switch** on every time-series chart: Bar (Stacked / Grouped) · Line · Area (stacked data only). Line/Area disabled with a reason when < 4 time points. Choice remembered per chart in `localStorage` | `ChartTypeSwitch`, `useChartPrefs` (§4.11.3) |
| F51 | **Expand to full screen** for every chart and table (modal, Esc, focus trap, toolbar kept, chart + table side by side/below, mobile landscape) | `FullscreenDialog` (§4.11.5) |
| F52 | **Export menu per chart/table**: PDF, PNG (charts), CSV (tables/chart data) | `ExportMenu`, `lib/export.ts`, `lib/png.ts`, `lib/pdf.ts` (§4.11.6, §4.12) |
| F53 | **Table exports**: CSV and PDF for Invoices list, monthly table, YoY table, utilities tables, manual-values table | `DataPanel` + `ExportMenu` |
| F54 | **Report PDF** for the whole Overview page and for each Analytics tab (or all tabs) | Page-header "Report (PDF)" action, `lib/pdf.ts`, `components/print/*` (§4.12.4) |
| F55 | Numeric time-series tables show a **"Show as chart"** switch (Invoices list → monthly totals of the filtered list; monthly table; YoY table; utilities tables; manual-values table) | `DataPanel` with `chartSpec` (§4.11.2) |

### 1.3 Behaviours that are easy to break in a redesign (preserve exactly)

1. **Month key = `"Mon YYYY"`** from `issueDate` (`page.tsx:60-70`). Manual values are stored under this key. Do not switch to ISO months in storage; convert only for display/filters.
2. **Manual heating maths**: adjustment = `manualValue × 76`; Central Heating gross/net reduced (floored at 0); a manual line is added; invoice total stays the same (`page.tsx:943-1017`; `LineItemTable.tsx:27-38`; `InvoiceCard.tsx:64-75`). Applied to the *display* and to *exports*, not written back to the DB.
3. **Heating row matching**: `=== 'central heating'`, includes `'central heating'`, or includes `'ciepła'`.
4. **Utility sub-type keyword rules** (Cold Water, Hot Water, Electricity, Central Heating, Waste Management) incl. Polish keywords (`zimnej wody`, `ciepłej wody`, `energii elektrycznej`, `ciepła`, `odpadami`) — triplicated at `page.tsx:375-385, 417-427, 459-469`.
5. **Combined invoice**: stored `invoiceType` stays `'Rent'` (`parseInvoice.ts:379-391`); parking is split out only where `description` contains "parking" (`page.tsx:78-82`).
6. **Unit-price chart** = average over matching lines of `grossValue / quantity` where `quantity > 0` (`page.tsx:480-486`).
7. **Duplicate key** = `invoiceNumber-issueDate`.
8. **Edit semantic** for net/tax/gross (F13) and its 0.01 tolerance.
9. **Persisted keys**: `invoice-parser-filters` (shape `{filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd}`), `invoice-parser-dark-mode`.

### 1.4 Top UX / visual problems (with references)

| # | Problem | Evidence |
|---|---|---|
| P1 | **No structure.** Upload, toolbar, filters, KPIs, table, detail, compare and 19 charts all stack on one page; after opening charts you scroll past a 26-row table to reach them. | `page.tsx:1188-2753` |
| P2 | **Charts hidden behind six cryptic toggles** in the filter bar ("Table", "Cumulative", "Gross", "Qty", "Unit Price", "YoY"). "Cumulative" is mislabelled — it shows monthly bars, and the running totals that were computed are never used. | `page.tsx:1807-1845`, `615` |
| P3 | **Copy-paste charts**: ~55 identical lines of Recharts × 19; three nearly identical data memos for rent/utility/parking. | `page.tsx:279-353, 2285-2728` |
| P4 | **Detail opens far from the click**: the selected invoice renders at the *top* of the page (above toolbar and table), so clicking row 20 scrolls you away from context. | `page.tsx:1255-1332` |
| P5 | **Hidden filter state**: date range is applied and persisted but has no control, so the list can be silently filtered with no visible reason and "Clear" doesn't appear for it. | `page.tsx:97-98, 534-554, 1796` |
| P6 | **Charts and filters disagree**: charts vanish when a type/month filter is on and ignore search/date range, with no message. | `page.tsx:2283, 2461, 2530, 2591` |
| P7 | **KPI numbers contradict charts** for the combined invoice: KPI cards count the whole Nov-2026 invoice as Rent (`invoiceType`), charts split parking out. The headline KPI is an invoice *count* in 30px bold; money is secondary. No "this month vs last month" or YoY. | `page.tsx:632-640, 1889-1930` vs `72-86`; `1862` |
| P8 | **Colour has three meanings for orange**: brand/selection/Month pill/upload/header gradient, *and* the Rent chart colour — while the Rent badge is blue. | `page.tsx:41, 2113, 2342`; `InvoiceCard.tsx:23`; `FileUpload.tsx:57` |
| P9 | **Toast contrast fails**: white text on `yellow-500` (≈1.9:1) and `green-500` (≈2.3:1); no `role`/`aria-live`; close button unlabeled; toast says `Click "Undo"` but has no Undo button (Undo lives in the toolbar). | `Toast.tsx:26-31, 56-75`; `page.tsx:776-779` |
| P10 | **Not keyboard/screen-reader usable**: sortable `<th onClick>` and clickable `<tr onClick>` are not focusable; icon-only buttons only have `title`; dropdown menus have no `aria-expanded`, Escape or arrow handling; zero `aria-*`/`role` attributes in `page.tsx` and `components/`. | `page.tsx:2012-2055, 2067, 2130-2147, 1568-1662` |
| P11 | **Global key hijacks**: ArrowUp/Down are `preventDefault`ed on the whole window (also inside inputs/selects and breaks page scroll); Cmd/Ctrl+F replaces browser find; Cmd/Ctrl+Z is intercepted even while typing in a field. | `page.tsx:893-940` |
| P12 | **Money formatting**: `en-US` locale for a Polish/PLN app ("PLN 1,234" in cards, "1,234.00 PLN" in table); amount and currency code are separate spans; no tabular numerals so columns don't align; manual value text uses `toFixed(2)`. | `page.tsx:1864, 2124-2126, 1278`; `InvoiceCard.tsx:14` |
| P13 | **Table**: month shown without year (Nov 2024 vs Nov 2025 look identical); no `overflow-x-auto` wrapper; `max-w-full` page stretches to 1920 px; `px-6 py-4` rows make 26 invoices ≈ 1,400 px tall; no mobile layout. | `page.tsx:2006, 2112-2116, 1191` |
| P14 | **Upload feedback**: non-PDFs silently ignored; one global "Processing…" that fades the whole drop zone to 50 %; failures shown as an un-dismissable red block above the toolbar that is wiped by the next upload; upload zone permanently occupies the top of the page even when you have data. | `FileUpload.tsx:27-29, 60, 91`; `page.tsx:1233-1253` |
| P15 | **Destructive actions**: deleting an invoice has no confirm and no in-toast Undo; "Clear" (delete all) sits next to the utility buttons in the toolbar; confirmation is a native `confirm()`. | `page.tsx:763-786, 1738-1747, 873` |
| P16 | **Useful parsed data never shown**: due date, sale date, bank account/payment method, seller/NIP — exactly what you need when paying. | `parseInvoice.ts:22-36`; absent from `InvoiceCard.tsx` |
| P17 | **Load failure looks like "no data"**: `loadInvoices` swallows errors and returns `[]`, so a network/Supabase problem shows "No invoices saved yet". No skeleton/loading state for the initial load either. | `storage.ts:97-100`; `page.tsx:182-204, 2731` |
| P18 | **Dark mode**: class is applied in an effect → flash of light theme; not system-aware; manual-value input has no dark classes; `.dark body` override duplicates tokens. | `page.tsx:136-179, 1295`; `globals.css:24-27`; `layout.tsx:15` |
| P19 | **Code shape blocks any design change**: 35 `useState`s, keyword matchers copied 3×, `utilityCategories` re-created each render and missing from memo deps, the `76` rate hard-coded in ≥ 10 places. | `page.tsx:89-123, 356-404`; `958, 1275-1278`; `InvoiceCard.tsx:64-72`; `LineItemTable.tsx:28, 99-114` |
| P20 | **Print CSS targets things that don't exist** (`aside`) and hides charts and `.flex-wrap button` globally. | `globals.css:42-105` |
| P21 | **Import can create duplicates in state**: imported rows are upserted by file `id` but prepended to local state without de-duplicating, so re-importing shows doubled rows (same React key) until reload. | `page.tsx:1033-1040` |
| P23 | **Buttons and controls have no system** (user feedback 2026-11-03: "the UI and the buttons are absolute crap"). 8 padding recipes, 3 radii, 10 colour families, 5 white-on-colour fills below 4.5:1, 7 unnamed icon-only buttons, no focus styles, 6 cryptic toggles, shifting toolbar clusters, fragile menus. Full audit with line refs: §2.7.1; fix: §2.7. | `page.tsx:1197–2277`, `Toast.tsx:63`, `FileUpload.tsx:63`, `error.tsx:15` |
| P22 | **Real data quirks the UI should surface**: stored line items include junk descriptions (e.g. `"5 OPŁATA ZA GOSPODARKA ODPADAMI 01/11/2025 - 30/11"`), a Rent invoice with gross 0 (Jan 2025), and `'Unknown'` invoice numbers are possible. Nothing flags parse problems. The just-fixed Nov-2026 bug (month showing `-`) would have been obvious with a "needs review" cue. | `data/invoices.json`; `parseInvoice.ts:30`; `page.tsx:49-58` |

---
## 2. Design direction — "Calm Ledger"

### 2.0 What the `ui-ux-pro-max` skill returned, and what I did with it

| Query | Result | Decision |
|---|---|---|
| `--design-system` "personal finance invoice tracker dashboard utilities" (density 7, motion 3) | Pattern "Product Demo", style **Glassmorphism**, font **Caveat/Quicksand** (handwritten) | **Rejected.** That is a landing-page recipe. Blur/transparent layers lower text contrast and a handwritten face is wrong for tables of numbers. |
| `--domain style` "fintech dashboard data-dense minimal" | **Data-Dense Dashboard** (BI/analytics): KPI cards row, sortable tables, filter sidebar, 12-col grid, sticky headers, light + dark, recharts-compatible, a11y risk low, checklist: grid layout, KPI cards responsive, tables sortable, filters functional, loading states, export | **Adopted** as the base style, softened to 8–12 px card padding → 16–20 px (comfortable-compact, since this is a 26-row personal tool, not a BI wall). |
| `--domain color` "fintech finance dashboard" | "Personal Finance Tracker": trust blue `#1E40AF` + profit green `#059669`, muted `#94A3B8`, dark bg `#0F172A` | **Partly adopted**: blue→Rent, green→Utility, slate neutrals, dark canvas near `#0E1116`. Re-tuned for colour-blind safety and verified contrast (§2.2). |
| `--domain typography` "professional dashboard clean data" | **Dashboard Data**: Fira Code (headings) + Fira Sans (body), "Code for data, Sans for labels" | **Adopted with a twist**: Fira Sans for everything, Fira Code *only* for invoice numbers/IDs/filenames. |
| `--domain chart` | Compare categories → bar (sorted); trend over time → line/area, but <4 points → stat card, ≤6 series; part-to-whole >5 → stacked bar not pie; every chart needs a visible data-table fallback and must not rely on colour alone | Applied in §4.7. |
| `--domain ux` | Focus states must be visible (High); reduced motion (High); confirm destructive actions (High); toasts auto-dismiss 3–5 s (Medium); empty states give an action; tables on small screens → scroll or cards; chip collections must wrap | Applied throughout. |
| `--stack nextjs` | Keep Client Components as leaves; `next/dynamic` for heavy components; default to Server Components | Layout chrome stays server; charts lazy-loaded with `next/dynamic` (`ssr:false`). The data pages stay client components because data comes from the browser Supabase client. |
| `--stack html-tailwind` | Semantic tokens in CSS-first `@theme`, not raw palette utilities everywhere | Applied in §2.2/§6. |

### 2.1 Principle

> **Quiet chrome, loud data.** Interface surfaces are neutral (paper-warm grey in light, ink in dark). The only saturated colours on screen are the four invoice types and the delta signals. One idea per screen; numbers are the hero (large, tabular, aligned).

Style name: *Data-Dense Dashboard, "ledger" treatment* — hairline rules instead of heavy boxes, 1 px borders not shadows on cards, generous numerals, mono for identifiers.
Density: **6/10** (comfortable-compact). Motion: **3/10** (subtle; no decorative motion; finance numbers never count up).

### 2.2 Colour tokens (concrete, contrast-checked)

Contrast ratios below were computed (WCAG relative luminance). Rule: **series colours are for fills/dots/lines only, never for small text** — labels use `--ink`.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--canvas` (page bg) | `#F4F4F1` | `#0E1116` | warm grey / ink; not pure white (skill: avoid pure white) |
| `--surface` (cards) | `#FFFFFF` | `#151A21` | |
| `--surface-2` (wells, table header, hover) | `#EDEDE8` | `#1C232C` | |
| `--surface-3` (selected row, pressed) | `#E4E4DD` | `#242D38` | |
| `--border` (hairlines, card edges) | `#E1E1DA` | `#2A323D` | decorative only |
| `--control-border` (inputs, checkboxes) | `#8A9099` (3.2:1 on white) | `#6B7686` (3.8:1 on surface) | meets 3:1 non-text |
| `--ink` (primary text) | `#1B1F24` (16.6:1 on white, 15.0 on canvas) | `#E8EAED` (14.5:1 on surface) | |
| `--ink-muted` | `#555C65` (6.8:1 / 6.1 canvas) | `#A4ACB7` (7.6:1) | secondary text |
| `--ink-subtle` | `#636A73` (5.5:1 white, 5.0 canvas, 4.7 surface-2) | `#8D96A2` (5.8:1) | captions; still ≥ 4.5:1 |
| `--primary` / `--on-primary` | `#1B1F24` / `#FFFFFF` | `#E8EAED` / `#0E1116` | primary button = ink; no brand colour competing with data |
| `--focus` (ring) | `#1D4ED8` (6.7:1) | `#7AA7FF` (7.3:1) | 2 px ring + 2 px offset |
| **Rent** `--rent` | `#1D5FA8` (6.5:1) | `#6CB0F0` (7.6:1) | tint light `#E5EEF8`, dark `rgb(108 176 240 / .14)` |
| **Parking** `--parking` | `#A63D78` (5.9:1) | `#E58BBA` (7.3:1) | tint `#F6E6EF` / `rgb(229 139 186 / .14)` |
| **Utility** `--utility` | `#0A7456` (≈5.5:1) | `#3CCB9C` (8.5:1) | tint `#DFF1EA` / `rgb(60 203 156 / .14)` |
| **Other** `--other` | `#5F6B7A` (5.4:1) | `#9AA6B5` (7.1:1) | tint `#EAECEF` / `rgb(154 166 181 / .14)` |
| Cost up `--increase` | `#B42318` (6.6:1) | `#FF8A7A` (7.6:1) | always with ▲ and "+" sign |
| Cost down `--decrease` | `#067647` (5.7:1) | `#4ADE9A` (10.2:1) | always with ▼ and "−" sign |
| Warning `--warning` / tint | `#8A5A00` (5.9:1) / `#FBF0D9` | `#F2B84B` / `rgb(242 184 75 / .14)` | |
| Danger `--danger` / tint | `#B42318` / `#FCE9E7` | `#FF8A7A` / `rgb(255 138 122 / .14)` | destructive buttons use solid danger + white (light) / dark-ink (dark) text |

Colour-blind safety: Rent (blue) / Parking (reddish-purple) / Utility (bluish-green) follow the Okabe-Ito family. Because Rent and Parking have similar luminance, charts never rely on hue alone: fixed stack order (Rent bottom → Parking → Utility), 1.5 px `--surface` gap between segments, direct labels in legend and tooltip, and Parking gets a diagonal-hatch fill option in the "Separate scales" view. Type chips always show **label text + dot**, KPI cards add an icon.

**Utility sub-type colours** (Analytics → Utilities; fills only, ≥ 3:1 against the surface):

| Sub-type | Light | Dark | Icon (lucide — verify exact names on install) |
|---|---|---|---|
| Cold Water | `#1B8FCB` (3.6:1) | `#4DB6F0` | `Droplet` |
| Hot Water | `#D55E00` (3.9:1) | `#FF8A3D` | `Droplets` / `ThermometerSun` |
| Electricity | `#B98300` (3.3:1) | `#F2C14B` | `Zap` |
| Central Heating | `#7A4FB0` (5.9:1) | `#B393E8` | `Heater` / `Flame` |
| Waste Management | `#4C8C4A` (4.1:1) | `#7FC77A` | `Trash2` |

**Year series (YoY chart):** same hue as the selected type, fading with age: current year solid 100 % + 2.5 px; previous year dashed 65 %; two years back dotted 40 %. Colour differences are backed by dash patterns and end-of-line labels.

Semantic composite for the combined invoice: **"Rent + Parking" badge** = two overlapping dots (blue + purple) + the text "Rent + Parking". Derived for display only; stored `invoiceType` stays `'Rent'`.

Token wiring (Tailwind v4, CSS-first — goes in `app/globals.css`, replaces the current dark-body override):

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

:root {
  --canvas:#F4F4F1; --surface:#FFFFFF; --surface-2:#EDEDE8; --surface-3:#E4E4DD;
  --border:#E1E1DA; --control-border:#8A9099;
  --ink:#1B1F24; --ink-muted:#555C65; --ink-subtle:#636A73;
  --primary:#1B1F24; --on-primary:#FFFFFF; --focus:#1D4ED8;
  --rent:#1D5FA8; --parking:#A63D78; --utility:#0A7456; --other:#5F6B7A;
  --increase:#B42318; --decrease:#067647; --warning:#8A5A00; --danger:#B42318;
  /* …tints, utility sub-type colours… */
  color-scheme: light;
}
.dark {
  --canvas:#0E1116; --surface:#151A21; --surface-2:#1C232C; --surface-3:#242D38;
  --border:#2A323D; --control-border:#6B7686;
  --ink:#E8EAED; --ink-muted:#A4ACB7; --ink-subtle:#8D96A2;
  --primary:#E8EAED; --on-primary:#0E1116; --focus:#7AA7FF;
  --rent:#6CB0F0; --parking:#E58BBA; --utility:#3CCB9C; --other:#9AA6B5;
  --increase:#FF8A7A; --decrease:#4ADE9A; --warning:#F2B84B; --danger:#FF8A7A;
  color-scheme: dark;
}
@theme inline {                       /* makes bg-canvas, text-ink, border-border, text-rent … available */
  --color-canvas: var(--canvas);  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);  --color-surface-3: var(--surface-3);
  --color-border: var(--border);  --color-control: var(--control-border);
  --color-ink: var(--ink);  --color-ink-muted: var(--ink-muted);  --color-ink-subtle: var(--ink-subtle);
  --color-primary: var(--primary);  --color-on-primary: var(--on-primary);  --color-focus: var(--focus);
  --color-rent: var(--rent);  --color-parking: var(--parking);
  --color-utility: var(--utility);  --color-other: var(--other);
  --color-increase: var(--increase);  --color-decrease: var(--decrease);
  --font-sans: var(--font-fira-sans), system-ui, sans-serif;
  --font-mono: var(--font-fira-code), ui-monospace, monospace;
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 14px; --radius-xl: 20px;
}
```
Components then use `bg-surface text-ink border-border` and **no `dark:` prefixes** (theme flips by variables). Because charts use SVG attributes, a small `useChartColors()` hook reads the CSS variables so Recharts follows the theme.

### 2.3 Typography

| Role | Font | Why |
|---|---|---|
| UI + headings + numerals | **Fira Sans** 400 / 500 / 600 / 700 | Skill "Dashboard Data" pairing; humanist, clear numerals; includes `latin-ext` (needed for Polish ł ż ś ć ą ę ó ń on line-item descriptions) |
| Identifiers (invoice numbers `FA/MYS/124/11/2026`, filenames, bank account) | **Fira Code** 400 / 500 | Aligns slashes/digits; signals "this is an ID" |

Loaded with **`next/font/local`** (updated in round 2) from Fira Sans 400/500/600/700 and Fira Code 400/500 woff2 files kept in the repo (`app/fonts/…`), `subsets` latin + latin-ext, `display: 'swap'`; exposed as `--font-fira-sans` / `--font-fira-code`. Two small copies (Fira Sans 400 + 600, latin subset) also live in `public/fonts/` so `lib/png.ts` can embed them into exported PNGs (§4.12.3). This also removes the build-time Google Fonts network dependency (risk R5). Before any print/PDF export, `lib/pdf.ts` awaits `document.fonts.load('400 12px "Fira Sans"', 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ')` so the latin-ext glyphs are really loaded.
Global: `font-variant-numeric: tabular-nums` on every number cell, KPI and axis tick (Phase 1 acceptance: confirm Fira Sans `tnum` renders equal-width digits; if not, switch numerals to `ui-monospace` stack for tables only).

| Style | Size / line-height | Weight | Use |
|---|---|---|---|
| `kpi-lg` | 2.5rem / 2.75rem (40/44) | 600 | Overview hero total |
| `kpi` | 2rem / 2.25rem (32/36) | 600 | KPI cards |
| `h1` | 1.625rem / 2rem (26/32) | 600 | Page title |
| `h2` | 1.25rem / 1.75rem (20/28) | 600 | Card / section title |
| `h3` | 1.0625rem / 1.5rem (17/24) | 600 | Sub-sections, drawer sections |
| `body` | 0.9375rem / 1.4rem (15/22.4) | 400 | Default |
| `table` | 0.875rem / 1.25rem (14/20) | 400/500 | Table cells |
| `label` | 0.8125rem / 1.125rem (13/18) | 500 | Field labels, table headers (sentence case, **not** ALL CAPS) |
| `caption` | 0.75rem / 1rem (12/16) | 400 | Axis ticks, helper text (never below 12 px) |

### 2.4 Spacing, radius, elevation

- **Spacing** (4 px base): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 (Tailwind `1,2,3,4,5,6,8,10,12,16`). Card padding 20 (16 on phones). Grid gap 16 (24 ≥ 1280). Section gap 24/32.
- **Layout constants**: sidebar 232 px (rail 64), top bar 56, bottom nav 56 + safe-area, drawer 640 (≥1280), 560 (1024–1279), full-width sheet below 1024; content max-width 1200 px centred; table rows 52 px comfortable / 40 px compact.
- **Radius**: `sm` 6 (inputs, chips, checkboxes) · `md` 10 (buttons, menus) · `lg` 14 (cards) · `xl` 20 (dialogs, sheet top corners) · `full` (type badges, segmented items).
- **Elevation**: cards = 1 px `--border`, **no shadow**. `e1` sticky bars: `0 1px 0 var(--border)`. `e2` menus/popovers: `0 8px 24px -6px rgb(16 24 40 / .16), 0 0 0 1px var(--border)`. `e3` drawer/dialog: `0 24px 48px -12px rgb(16 24 40 / .28)`. In dark mode depth comes from lighter surfaces + border, shadows kept subtle. Scrim: `rgb(14 17 22 / .45)` light, `rgb(0 0 0 / .6)` dark (re-check composed contrast when built).

### 2.5 Iconography

`lucide-react`, stroke 1.75, sizes 16 (inline) / 20 (buttons, nav) / 24 (empty states). Never emoji, never inline-pasted SVG. Decorative icons next to text: `aria-hidden`; icon-only buttons: `aria-label` + tooltip text. Icons by role: Overview `LayoutDashboard`, Invoices `ReceiptText`, Analytics `ChartColumn`, Data `Database`, Upload `Upload`, Search `Search`, Filter `ListFilter`, Sort `ArrowUp/ArrowDown`, Edit `Pencil`, Delete `Trash2`, Compare `GitCompare`, Export `Download`, Import `FileUp`, Theme `Sun/Moon/Monitor`, More `Ellipsis`, Close `X`, Copy `Copy/Check`; types: Rent `House`, Parking `SquareParking`, Utility `Plug`, Other `Receipt`. (Verify each name exists in the installed lucide version in Phase 1.)

### 2.6 Motion principles

Tokens: `--dur-fast 120ms` (hover/press), `--dur-base 200ms` (menus, tab content), `--dur-slow 320ms` (drawer, dialog); `--ease-out cubic-bezier(.2,.8,.2,1)` for enters, `--ease-in cubic-bezier(.4,0,1,1)` for exits; exits ≈ 70 % of enter.

1. **One orchestrated moment**: first load of Overview — KPI cards fade + rise 8 px (240 ms, 50 ms stagger), then chart bars grow from baseline (450 ms) **once**. Nothing re-animates on filter/tab changes.
2. Drawer slides from right 320 ms in / 220 ms out with scrim fade; bottom sheet slides up. Toast rises 240 ms.
3. Table rows: hover and press change background colour only (no transforms). Controls (rule 6) are different: they scale, because they are small and self-contained.
4. **No count-ups from zero.** A money value never counts up on first load or when a page opens. It appears at its final value. The only number motion is rule 5: a value that is already on screen and then changes.
5. **Rolling digits (odometer)** — `components/ui/RollingNumber.tsx`, pure planning in `lib/rolling.ts`. When a total that is already visible changes, each digit is a vertical 0–9 strip that slides to the new digit.
   - **Which digits move:** only digits that changed, plus new leading digits when the number gets longer (those slide/fade in 35 %). Unchanged digits stay still. Separators, NBSP, minus sign and "zł" never move. Text is aligned from the right, so `999,00 zł` → `1 000,00 zł` keeps every column in place. A number that gets shorter just loses its leading characters at once.
   - **Timing:** moving digits start one after another, **left to right, 40 ms apart**, capped at 8 steps (so at most 280 ms of delay); each takes **520 ms** with `cubic-bezier(.16, 1, .3, 1)` (fast start, soft settle). No overshoot on purpose: a bounce would flash the neighbouring digit. A long number finishes in under 0.85 s.
   - **First render: no animation.** Rule 4 forbids count-ups, and a number that is simply there is more trustworthy for money. Under `prefers-reduced-motion: reduce` the value swaps instantly (no strip movement, no delay).
   - **Numbers stay aligned:** Fira Sans tabular figures (`font-variant-numeric: tabular-nums`) so a digit never changes the width. Text comes from `lib/format.ts` (`fmtMoney`, `fmtMoneyWhole`, plain counts); the component only animates it.
   - **Accessibility:** the real value is in a visually hidden span; the animated strips are `aria-hidden`. It is **not** a live region by default. Pass `live="polite"` only where a value changes because of something the user is waiting for, not on every KPI change; the Overview KPI spec in §4.2 does not ask for one. Visible digits stay selectable, so copy gives the real number.
   - **Where it is used:** Overview KPI cards in Phase 5 (value and delta lines, after the period switcher or data changes); the total label above each stacked bar and the `Showing 9 of 26 · 11 204,10 zł` result strip on Invoices (Phase 8); table footers, i.e. the Total row of monthly, YoY and utilities tables (Phase 4–5) and the totals in the invoice drawer (Phase 9). Not used for table body cells, chart axis ticks, tooltips or anything inside a print/PDF render (§4.12), which always show static text. In Phase 1 it is already on the old page's KPI cards (counts, totals, averages).
6. **Press feedback: sink to 95 %, spring back.** One shared mechanism in `app/controls.css` for `Button`, `IconButton`, `SegmentedControl` items and `ToggleChip` (a `MenuButton` trigger is a `Button`).
   - **Press:** `transform: scale(.95)` in **90 ms** `ease-out`, on `:active` and on `data-pressed` (set by `components/ui/PressFeedback.tsx` for Enter and Space, held at least 110 ms so a quick key press is visible).
   - **Release:** springs back in **360 ms** with a slight overshoot (about 1.2 % over, then settles). The easing is a damped-spring `linear()` curve (ζ 0.4); browsers without `linear()` use `cubic-bezier(.34, 1.56, .64, 1)`.
   - **Safe:** transform only, so layout never shifts and hit areas stay put. Not applied to `aria-disabled` or `aria-busy` (disabled and loading) controls. Not applied to text links, tabs or table rows.
   - **Reduced motion:** no scale and no spring; the existing colour change (hover/pressed colours from §2.7.3) is all that remains.
   - Replaces the older line "no layout-shifting transforms" for controls: this is a transform, but it never changes layout.
7. `prefers-reduced-motion: reduce`: durations → ~0, transforms removed (opacity only), rolling digits swap instantly (rule 5), controls do not scale (rule 6), Recharts `isAnimationActive={false}`, skeleton shimmer → static.

### 2.7 Buttons & controls system (added after feedback: "the UI and the buttons are absolute crap")

The plan had colours, type and spacing but no control system. This section is the contract. Rule for the whole redesign: **no raw `<button>`, `<select>`, `<input>` or checkbox is styled in place.** Everything comes from `components/ui/*` (§6.1) and only uses tokens from §2.2 (no `gray-*`, `orange-*`, `blue-*` … utility classes anywhere). Wireframe glyphs in this plan (🔍 ⤢ ⋯ ▾ ▲) are sketch shorthand only; the real UI uses `lucide-react` icons (§2.5).

#### 2.7.1 Audit of the current buttons and controls

Counted in code: 31 `<button>` in `app/page.tsx`, 1 in `components/Toast.tsx:63`, 1 in `app/error.tsx:15`, 4 clickable `<th>` (`page.tsx:2012–2056`), a clickable `<tr>` (`2068`), a `<summary>` used as a button (`1946`), and an invisible file input acting as a button (`FileUpload.tsx:63`). Together they use **8 different padding recipes, 3 corner radii and 10 colour families** with no shared component.

| # | What is wrong | Evidence |
|---|---|---|
| B1 | **No shared size.** Heights range from 24 px to 40 px: `px-2 py-1 text-xs` ≈ 24 px (`1811–1841`), `p-1` + 20 px icon ≈ 28 px (`1987`), `px-3 py-1.5 text-sm` ≈ 32 px (`1574, 1618, 1669, 1687, 1712`), `p-2` ≈ 36 px (`1199`), `px-4 py-2` 36–40 px (`1301, 1307, 1316, 2246, 2252`, `error.tsx:15`). Radii mix `rounded-lg` (`1199, 1301`), `rounded-md` (`1574, 2246`) and `rounded` (`1811`, `1987`, `error.tsx:15`). |
| B2 | **Colour has no meaning.** Same job, different look: manual-value Save is green (`1301`), Cancel solid grey (`1307`), Edit blue (`1316`); the invoice-edit Save/Cancel pair is blue-600 / light grey (`2246–2252`). Compare mode is orange (`1689`), "View" is teal (`1712`), Undo amber (`1729`), Clear red (`1740`), error "Try again" orange (`error.tsx:15`). Orange is also the brand, the Rent chart and the selection colour (P8). |
| B3 | **Contrast fails.** White text on: green-500 **2.3:1** (`1301`), grey-400 **2.5:1** (`1307`), teal-500 **2.5:1** (`1712`), orange-500 **2.8:1** (`error.tsx:15`), blue-500 **3.7:1** (`1316`). Coloured text on white: amber-600 3.2:1 (`1729`), red-500 3.8:1 (`1740`), orange-600 3.6:1 (`1799`, `2273`). Icons in grey-400 are 2.5:1, below the 3:1 needed for icons that carry meaning (`1262`, `1345`, `2132`, `2141`). |
| B4 | **Icon-only buttons with no name.** Theme (`1197`), close (`1260`, `1339`), table collapse (`1985`), row edit/delete (`2130`, `2139`), toast close (`Toast.tsx:63`). Only three have a `title`; none have `aria-label`. Bare 20 px icons with no padding on `1262`, `1345`, `2132`, `2141`; Edit and Delete are 8 px apart (`2129`, `gap-2`) with Delete one click and no confirm. |
| B5 | **Not keyboard-operable.** Sort headers `<th onClick>` (`2012–2056`), clickable row (`2068`), `<summary>` at 12 px (`1946`), and the upload drop zone is an `opacity-0` file input stretched over the box (`FileUpload.tsx:63`) so the real control shows no focus. |
| B6 | **No focus style.** No button has a `focus-visible` style (browser default only). Inputs each have a different ring: orange (`1767, 1775, 1787`), blue (`1295, 2169, 2193`), teal checkbox (`2102`). |
| B7 | **Cramped, shifting clusters.** Toolbar has 6 ghost buttons at `gap-1` = 4 px (`1566`). Undo (`1726`) and "View (n/2)" (`1701`) appear and push their neighbours; Compare mode adds a table column (`2009`) so the table reflows. Dividers are hand-made `w-px h-6` (`1664`, `1805`). The filter bar crams search, 2 selects, Clear and 6 toggles in one wrapping row (`1756–1846`). |
| B8 | **Toggles that look like tabs.** The 6 view buttons (`1809–1839`) are on/off switches with no `aria-pressed`; "on" is orange-100 vs grey-100, about 1.1:1 apart. Colour is the only signal. |
| B9 | **Menus are fragile.** A full-screen invisible `fixed inset-0 z-10` div catches outside clicks (`1586`, `1630`) so the first outside click is eaten; no `aria-haspopup` / `aria-expanded`, no Esc, no arrow keys, no focus return. Menu icons are a rainbow (green, purple, blue, indigo, emerald: `1592, 1601, 1636, 1645, 1654`) that means nothing. "File" mixes Import with "Save Session" (a sync action). |
| B10 | **Destructive actions are exposed.** "Clear" (deletes everything) sits in the main toolbar next to Undo (`1738`) and uses a native `confirm()` (`873`). Three different actions are called "Clear" / "Clear Filters" (`1746`, `1801`, `2275`). |
| B11 | **Labels.** Cryptic ("Cumulative", "Gross", "Qty", "YoY": `1819–1843`; "View (1/2)": `1719`; "Save Session": `1604`). Mixed case ("Save Changes" `2254`, "Clear Filters" `2275`, "Add Manual Value" `1318` vs "Clear" `1801`). Print is regular grey-600 (`1669`) while File/Export are medium grey-700 (`1574`). |
| B12 | **Inputs.** Search and both selects have no visible label (`1762–1793`); `type="number"` (`1285`, `2184`) shows spinners and changes value on mouse wheel; no clear button; no error state. |
| B13 | **Glyphs.** There is no emoji in the code today, but sort direction is a text arrow `↑` / `↓` shown only on the active column (`2019`), which shifts the header text. |

#### 2.7.2 Control tokens (add to the §2.2 block)

Only the state colours that §2.2 does not already give. Everything else reuses `--primary`, `--surface*`, `--border`, `--control-border`, `--ink*`, `--danger`, `--focus`.

```css
:root {
  --primary-hover:#2D333A; --primary-active:#0D0F12;
  --danger-hover:#9A1D14;  --danger-active:#7F170F;  --on-danger:#FFFFFF;
  --danger-tint-strong:#F8D2CE;
}
.dark {
  --primary-hover:#F3F4F6; --primary-active:#D0D4D9;
  --danger-hover:#FFA091;  --danger-active:#F2705F;  --on-danger:#0E1116;
  --danger-tint-strong:rgb(255 138 122 / .24);
}
```
Contrast (computed): white on `#B42318` 6.6:1; `#0E1116` on `#FF8A7A` 8.2:1, on `#F2705F` 6.5:1; `--on-primary` on every primary state ≥ 11:1. Phase 1 re-measures all of them with the script (§2.7.11).

#### 2.7.3 Button spec

**Variants** (all `<button type="button">` unless it navigates, then `<a>`/`next/link`):

| Variant | Light | Dark | Use |
|---|---|---|---|
| `primary` | bg `--primary`, text `--on-primary`; hover `--primary-hover`; pressed `--primary-active` | same tokens (light fill in dark) | The single main action of a surface. Weight 600. |
| `secondary` | bg `--surface`, 1 px `--control-border`, text `--ink`; hover bg `--surface-2`; pressed `--surface-3` | same tokens | Normal actions: Export, Compare, Report, Reload, Edit. |
| `ghost` | transparent, no border, text `--ink`; hover `--surface-2`; pressed `--surface-3` | same | Low-emphasis: Cancel, Clear all, Copy, Undo, Prev/Next. |
| `destructive` | bg `--danger`, text `--on-danger`; hover `--danger-hover`; pressed `--danger-active` | same tokens | **Only** the confirm button inside a confirmation dialog. |
| `destructive-quiet` | bg `--surface`, 1 px `--danger`, text `--danger`; hover bg `--danger-tint`; pressed `--danger-tint-strong` | same | Entry point to a destructive flow (Delete in drawer, "Delete all invoices…"). Danger text on surface is 6.6:1 light / 7.6:1 dark. |
| `link` | no box, text `--ink`, 1 px underline always on (offset 3 px); hover underline 2 px; pressed `--ink-muted` | same | Navigation inside text and cards ("View all invoices →"). Renders `<a>`. Never used for actions that change data. |
| icon-only | see §2.7.4 | | |

**Sizes** (all variants; radius is `--radius-md` 10 px everywhere, so buttons, inputs, selects and segmented controls in the same row share corners — this overrides the 6 px for inputs in §2.4):

| Size | Height (mouse / touch) | Padding x | Font | Icon | Gap icon–label | Used for |
|---|---|---|---|---|---|---|
| `sm` | 32 / 36 px | 12 | 13/18, 500 | 16 | 6 | Inside cards, chart toolbars, table rows, toasts |
| `md` (default) | 40 / 44 px | 16 | 14/20, 500 | 16 | 8 | Page header, filter bar, forms, dialog and drawer footers |
| `lg` | 48 / 48 px | 20 | 15/22, 500 | 20 | 8 | Empty-state and error-page main action, sticky phone bars |

"Touch" means `@media (pointer: coarse)`. Where the visual height stays below 44 px (`sm` = 36 px), an invisible `::after { inset: -4px }` brings the hit area to 44 px; neighbours keep ≥ 8 px gap so hit areas never overlap. On a mouse the smallest visible control is 32 px, above the 24 px minimum. Min width 72 px for text buttons; labels never wrap or truncate (`white-space: nowrap`) — shorten the copy instead. All icons use stroke 1.75 (§2.5; text-button icons are 16 px, which updates the "20 px for buttons" in §2.5: 20 px is for `lg` and icon-only `md`).

**States** (identical shape in both themes; colours from the variant table):

| State | Rule |
|---|---|
| Default | As above. |
| Hover | Background/border colour only, 120 ms (`--dur-fast`). Never movement or scale. |
| Active / pressed | Pressed colour from the table, plus the press feedback of §2.6 rule 6: scale to 95 % in 90 ms, spring back in 360 ms with a slight overshoot (transform only, no layout shift; not when disabled or loading; none under reduced motion). Same in touch and for Enter / Space. |
| Focus-visible | Global ring `outline: 2px solid var(--focus); outline-offset: 2px` (6.7:1 light, 7.3:1 dark). Inside clipped containers (menus, table cells, drawer edges) use `.focus-inset` = `outline-offset: -2px`. Mouse clicks do not show the ring (`:focus-visible` only). |
| Disabled | `aria-disabled="true"` (not the `disabled` attribute) so it stays focusable and can explain itself. Style: bg `--surface-2`, text `--ink-subtle` (≥ 4.7:1), no fill colour, `cursor: not-allowed`; secondary keeps a 1 px `--border`. **A reason is required**: `disabledReason="Select one more invoice"` is shown in a tooltip (hover + focus), linked with `aria-describedby`, and, for touch, also as helper text next to the control when it is a form or selection action. Click is ignored. Type-level: `Button` has no way to be disabled without a reason. No opacity-50 tricks (unpredictable contrast). |
| Loading | `aria-busy="true"` + `aria-disabled="true"`; shown after 150 ms to avoid flashes; keeps the pressed colour so it still looks busy under reduced motion. A 16 px spinner (stroke 2, 700 ms linear; static under reduced motion) **replaces the leading icon**. With no leading icon, the label stays in place with `visibility: hidden` and the spinner is centred over it. Either way the **width never changes**. Result is announced in the `aria-live` region (toast or inline "Saved"). |

**Icon + label rules**
1. Page-header and toolbar buttons: leading icon + label (Upload, Export, Compare, Report). Dialog, drawer and form footer buttons: label only (Cancel, Save changes, Done, Retry).
2. Trailing icon only for a menu chevron (`ChevronDown`, rotates 180° when open) or a forward arrow in a `link`. Never both leading and trailing except a menu button.
3. Icons are always `aria-hidden`, always inherit text colour (no coloured icons), and one cluster uses icons consistently (all or none).
4. Labels: sentence case, verb first, ≤ 24 characters, name the object when it matters (`Upload PDFs`, `Export`, `Delete 26 invoices`). "…" at the end only when the item opens a dialog that needs more input. No "Click here", no ALL CAPS, no unexplained abbreviations.
5. Icon-only buttons are a short allowed list (§2.7.4). Everything else is labelled, including on phones.

**One primary per surface.** A "surface" is the shell (top bar), a dialog, a drawer or sheet, or an empty-state panel. Inline cards, tables, filter bars and toolbars never contain a primary button: they use `secondary` / `ghost`. So the only primaries are: top-bar **Upload PDFs** (the global action), the main button in a dialog/drawer footer, and the empty-state CTA. Where an empty-state panel shows the Upload CTA, the top-bar Upload is **hidden** (replaced, not duplicated). Confirmation dialogs have no primary; their one emphasised button is `destructive`.

**Placement**
- Dialog / drawer footer: right-aligned, order `[ghost Cancel] [primary Save]`, primary last. At < 640 px the footer is sticky; two buttons share the width 50/50 (primary on the right); three or more stack with the primary on top.
- Destructive actions never sit next to Save/primary in a toolbar. Single delete lives in a row ⋯ menu (last item, after a divider, danger text) and in the drawer header area as `destructive-quiet`, left-aligned and separated from Save/Cancel by free space. Delete one invoice = no confirm, Undo toast (§4.3). Delete all = dialog only, **Cancel is auto-focused**, the `destructive` button is named with the count ("Delete 26 invoices").
- Cancel is always `ghost`; Undo in a toast is `ghost sm`.

#### 2.7.4 Icon-only button, link, tooltip

- **`IconButton`**: square, side = the size's height (32 / 40 / 48; 44 hit area on touch). `label` is a **required prop** (becomes `aria-label` and the tooltip text), so it cannot be written without a name. Variants `ghost` (default) and `secondary`. Icon colour `--ink-muted` (6.8:1), hover `--ink`.
- **Allowed icon-only list** (each with label + tooltip): Close ✕, Dismiss notification ✕, Clear search ✕, Row actions ⋯ (label includes the invoice number: "Actions for FA/MYS/124/11/2026"), Previous / Next month ‹ ›, nav rail items (§3.3), theme in the collapsed rail. Anything else gets a visible label.
- **`Tooltip`**: bg `--primary`, text `--on-primary` (inverts per theme, ≥ 11:1), 12/16 weight 500, padding 4 × 8, radius 6, max width 240 px, 8 px from trigger. Opens after 400 ms hover, instantly on keyboard focus; closes on Esc, blur, or pointer leaving both trigger and tooltip (stays open while hovered, WCAG 1.4.13). `role="tooltip"`, trigger gets `aria-describedby` (icon-only buttons rely on `aria-label`; the tooltip is `aria-hidden` for them to avoid double reading). Not shown on touch: anything a touch user must know is also written as visible text. Never holds essential or interactive content.

#### 2.7.5 Which control for which job

| Job | Control |
|---|---|
| Do something (save, export, upload) | `Button` |
| Go somewhere | `<a>` / `link` variant, or a nav item / `Tab` |
| Switch between 2–5 exclusive views or ranges | `SegmentedControl` |
| Switch between exclusive sections of a page (Analytics) | `Tabs` |
| Turn a filter or series on/off | `ToggleChip` (`aria-pressed`) |
| Pick one from many (From/To month, Type in a form) | `Select` |
| A list of related actions (Export, row actions, Report scope) | `MenuButton` |
| On/off setting or row selection | `Checkbox` |

#### 2.7.6 Segmented control, tabs, chips

**`SegmentedControl`** — Chart | Table, Bar | Line | Area, 6M | 12M | All | Custom, Cost | Usage | Unit price, System | Light | Dark.
- Semantics: `role="radiogroup"` with `role="radio"` items, roving `tabindex`; ← → (and ↑ ↓) move and select, Home/End jump, one Tab stop for the group. Visible `aria-label` or a label above.
- Look: track bg `--surface-2` with 1 px `--control-border`, radius 10, padding 2, gap 2. Items radius 8, padding x 12, min width 56, text 13/18 (`sm`, track 32 px) or 14/20 (`md`, track 40 px; 44 px on touch). **Selected** item: bg `--surface`, inset 1.5 px `--ink` ring, weight 600 (the ring keeps it ≥ 3:1 against the track in both themes; colour alone is never the signal). Unselected: text `--ink-muted`, hover text `--ink` + bg `--surface-3`. Label text always shown; an optional 16 px icon is allowed if every item has one.
- Limits: 2–5 items, labels ≤ 12 characters, never wrap or truncate. If it will not fit the container, it renders as a `Select` instead (prop `collapseBelow`), or takes the full row at phone width with equal-width items.
- Disabled item (e.g. Line with < 4 points): `aria-disabled`, dimmed text `--ink-subtle`, arrow keys skip it, hover/focus tooltip shows the reason, and the reason is **also printed as a caption under the toolbar** so touch users see it ("Line needs at least 4 months with data — you have 3.").
- Chart type: shown as **Bar | Line | Area**. When Bar is selected and the chart has more than one series, a `ToggleChip` "Stacked" appears next to it (on = Bar Stacked, off = Bar Grouped). This is a display mapping only; the stored values in §4.11.3 stay `bar-stacked | bar-grouped | line | area`.

**`Tabs`** (Analytics sections) — ARIA tab pattern (←/→, Home/End, panel `aria-labelledby`). Height 40, text 14/20, 16 px side padding, bottom hairline `--border`. Selected: 2 px `--ink` underline, text `--ink`, weight 600; unselected `--ink-muted`; hover `--surface-2`. Scrolls horizontally with edge fade only if the labels cannot fit at 320 px.

**`ToggleChip`** — filters and legend series. Button with `aria-pressed`. Height 32 (44 hit on touch), padding x 12, radius full, text 13/18 500, gap 8 between chips. Off: bg `--surface`, 1 px `--control-border`, text `--ink`. **On**: bg `--surface-3`, 1.5 px `--ink` border, weight 600, and a leading `Check` icon (16 px). Type chips keep their colour dot after the check and show the count in `--ink-muted`. Removable chips (active filters) hold the label plus a separate 24 px `X` button with `aria-label="Remove filter: Utility"`.

#### 2.7.7 Menu button and split button

**`MenuButton`** (Export ▾, Report ▾, row ⋯, Period ▾, Theme ▾) — trigger is a normal `Button` (`secondary` or `ghost`) with a trailing chevron, `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`.
- Panel: `--surface`, radius 10, elevation e2, padding 4, min width 220 px (≥ trigger width), aligned to the trigger's right edge when the trigger is in a right-aligned group. Opens/closes in 120 ms (opacity only under reduced motion).
- Items: height 36 (44 on touch), padding x 12, text 14/20, icon 16 in `--ink-muted` (all items have icons or none; never coloured), optional second line 12/16 `--ink-subtle` ("CSV — current list, adjustments included"), optional right-aligned shortcut. Groups are split by a 1 px `--border` line and an optional 12 px group label. Destructive item last, after a divider, danger text.
- Keyboard: Enter/Space/↓ opens and focuses the first item; ↑ ↓ move, Home/End, type-ahead, Esc closes and returns focus to the trigger, Tab closes. Focused item shows the `.focus-inset` ring plus bg `--surface-2`. Items are `role="menuitem"` with `aria-disabled` + reason when unavailable ("Nothing to export yet").
- Outside click closes through light-dismiss (native `popover`/`<dialog>`), **not** an invisible full-screen overlay div.
- Below 640 px the panel becomes a bottom sheet with 44 px items and a Cancel item.

**Split button: not used in v1.** Two hit areas inside one control are easy to mis-tap and awkward for screen readers. Export is a menu, because each format is a deliberate choice. Revisit only if one export format becomes the clear default.

#### 2.7.8 Inputs, selects, search, checkbox

- **`Field`** wraps every input: visible `<label>` above (13/18 500 `--ink`), optional helper (12/16 `--ink-subtle`), error line below with an `AlertCircle` icon (12/16 `--danger`), wired by `aria-describedby`; `aria-invalid` when in error. A placeholder never replaces a label. The one exception is Search: `aria-label` + `Search` icon + placeholder "Search number or file…".
- **`Input` / `Select`**: height 40 (`sm` 32, touch 44), padding x 12, radius 10, bg `--surface`, 1 px `--control-border`, text 14/20 `--ink`, placeholder `--ink-subtle` (5.5:1). Hover border `--ink-muted`. Focus: global ring (2 px `--focus`, offset 2). Error: 1.5 px `--danger` border + icon + message. Disabled: bg `--surface-2`, text `--ink-subtle`, with a reason when it is not obvious. Below 640 px and on touch, input font is 16 px so iPhone Safari does not zoom on focus.
- **Money / number inputs**: `type="text" inputMode="decimal"` (no spinners, no wheel changes), right-aligned, tabular numbers, `zł` as a read-only suffix inside the box, parsed with the same rules as `format.ts`.
- **Search**: leading `Search` icon, `Clear` icon button (24 px, `aria-label="Clear search"`, hit area 32) appears only when there is text; `/` focuses it (§4.3).
- **`Select`**: native `<select>` with `appearance: none` and a 16 px `ChevronDown` on the right, so the OS picker is used on phones and keyboard behaviour is free. Used for From/To months, Type in forms, YoY type.
- **`Checkbox`**: box 20 × 20, radius 6, 1.5 px `--control-border` (3.2:1); checked = bg `--primary` + `--on-primary` check icon; indeterminate = dash. The whole cell is the hit area (40 × 40 in table rows, 44 on touch). Focus ring on the box. Disabled uses `aria-disabled` + reason ("Compare works with two invoices"). Label always visible or `aria-label` ("Select FA/MYS/124/11/2026").

#### 2.7.9 Groups, toolbars, overflow

- **Spacing**: 8 px between buttons in a group, 16 px between groups, a 1 px `--border` vertical divider (20 px tall) only when two groups share a row. Never attach buttons together (segmented control is the only joined control). Same height in a row: page-level rows use `md`, anything inside a card or table uses `sm`. Never mix sizes in a row.
- **Alignment**: titles and filters left, actions right; inside a right group the primary is last (rightmost), secondary to its left. Max in one page header: 1 primary + 1 secondary + 1 menu.
- **No hidden shifts**: a control that sometimes appears (Undo, Compare) keeps its space or lives in a bar that is shown/hidden as a whole; nothing moves when it appears.
- **No `role="toolbar"` roving focus** (it clashes with radiogroup arrows). Groups use `role="group"` + `aria-label`, and every control is a normal Tab stop; there are few of them.
- **Overflow into "More"**: each action in an `ActionBar` has a priority (1 stays, 2 goes first, 3 goes always). `More` is a labelled `secondary` button with an `Ellipsis` icon and the word "More" (a bare ⋯ is only used for row actions). No horizontal scrolling button rows.

| Bar | ≥ 1024 px | 640–1023 px | < 640 px |
|---|---|---|---|
| Top bar | Title · Report (PDF) (secondary, where it exists) · **Upload PDFs** | Same, Report moves into More | Title · **Upload** (icon + short label, never icon-only) · More |
| Filter bar (Invoices) | Search 280 px · type chips · Period · active chips row | Search 240 px, chips wrap to a second row | Search full width + `Filters (2)` secondary button opening a bottom sheet with chips and Period |
| `ChartToolbar` (§4.11) | Title left; `Full screen` and `Export ▾` right; second row: Chart \| Table · Bar \| Line \| Area · Stacked chip | Same | Row 1 title + `More ▾` (Full screen, Export PNG / CSV / PDF); row 2 Chart \| Table full width; row 3 Bar \| Line \| Area full width |
| Selection bar | "2 selected" left · Clear (ghost) · Compare (secondary) right, inline above table | Same | Sticky bottom bar above the tab bar, `md` buttons 44 px tall |
| Dialog / drawer footer | Right-aligned `[Cancel][Primary]` | Same | Sticky; 2 buttons 50/50, 3+ stacked, primary on top |

#### 2.7.10 Before / after: every current button and cluster

"Now" = `app/page.tsx` unless a file is named. New locations refer to §3–§4.

| Now (line) | Today | New control · variant · size | New label | New location |
|---|---|---|---|---|
| 1197 | Theme toggle, icon-only, no name | `MenuButton` ghost `md` with current icon (rail: `IconButton` + tooltip); Data page: `SegmentedControl` System / Light / Dark | "Theme: System" (sidebar), "Theme" (rail label) | Sidebar footer; Data → Appearance |
| 1260 | Detail close ✕ | `IconButton` ghost `sm` | "Close" (aria-label + tooltip) | Drawer header, right |
| 1299 | Manual value Save (green) | `Button` secondary `sm` | "Save" | Drawer → Manual heating card; (Data table saves on Enter/blur) |
| 1305 | Manual value Cancel (grey) | `Button` ghost `sm` | "Cancel" | Same card |
| 1314 | Add / Edit Manual Value (blue) | `Button` secondary `sm` | "Add units" / "Edit units" | Same card |
| 1339 | Comparison close ✕ | `IconButton` ghost `sm` + footer `Button` secondary `md` | "Close" | Compare dialog header and footer |
| 1569 | "File ▾" menu | Removed as a menu; items go to Data page (below) | — | — |
| 1589 | Import JSON (green icon) | `Button` secondary `md`, opens preview dialog whose main button is primary "Import 23" | "Choose JSON file…" | Data → Import |
| 1598 | Save Session (purple icon) | `Button` secondary `md` with loading state | "Save manual values now" | Data → Sync |
| 1613 | "Export ▾" menu | `MenuButton` secondary `md` (+ `Download` icon) | "Export" | Invoices page header (left of Upload) |
| 1633 / 1642 / 1651 | Export JSON / CSV / Excel items (coloured icons) | Menu items, mono icons, with 2nd line of explanation | "JSON (all invoices)", "CSV (current list)", "Excel-compatible (.xls)", plus "PDF (current list)" | Same menu; same set as buttons in Data → Export |
| 1667 | Print | Menu item after a divider in the Export menu; `Button` secondary `md` on Data → Print | "Print list…" / "Print invoice list" | Invoices Export menu; Data → Print |
| 1679 | Compare mode toggle (orange) + extra table column | No mode: `Checkbox` column always visible (§4.3); no toggle button | — | Invoices table |
| 1702 | "View (n/2)" (teal, appears) | `Button` secondary `md` with `GitCompare` icon; always present in the selection bar; `aria-disabled` + reason until 2 are picked | "Compare 2 invoices" (reason: "Select one more invoice") | Selection bar |
| 1727 | Undo (amber, appears in toolbar) | Toast action `Button` ghost `sm` (8 s) + `Cmd/Ctrl+Z`; plus `Button` ghost `sm` at the right end of the result strip while the undo stack is non-empty (reserved space, no shift) | "Undo" / "Undo delete" | Toast; Invoices result strip |
| 1738 | "Clear" = delete all, in main toolbar | `Button` destructive-quiet `md`, opens dialog with `destructive` "Delete 26 invoices" and auto-focused ghost "Cancel" | "Delete all invoices…" | Data → Danger zone only |
| 1762 | Search input, no label, no clear | `Input` (search) with Clear `IconButton` | "Search number or file…" | Invoices filter bar |
| 1772 | Type `<select>` with counts | `ToggleChip` group (radio behaviour) with counts; `Select` in the phone Filters sheet | "All 26", "Rent 12", … | Invoices filter bar |
| 1784 | Month `<select>` | `Period` `MenuButton` secondary `md` → popover with presets and From/To `Select`s | "Period: Jan 2025 – Nov 2025" | Invoices filter bar |
| 1797 | "Clear" filters (orange text) | `Button` ghost `sm` after the active chips; removable chips | "Clear all" | Active-filter row |
| 1809 | "Table" toggle | Dropped (F12) | — | — |
| 1815 | "Cumulative" | `Tabs` item | "Monthly costs" | Analytics tab 1 |
| 1821 / 1827 / 1833 | "Gross" / "Qty" / "Unit Price" | `SegmentedControl` `md` | "Cost" / "Usage" / "Unit price" | Analytics → Utilities |
| 1839 | "YoY" | `Tabs` item | "Year over year" | Analytics tab 3 |
| 1946 | `<summary>` "Monthly Sum" | `SegmentedControl` `sm` | "Chart \| Table" | Overview → Monthly costs card |
| 1985 | Table collapse chevron | Dropped (F11) | — | — |
| 2012–2056 | Clickable `<th>` + text arrows | `SortButton` (ghost, inside `<th aria-sort>`, `ArrowUp/ArrowDown` icon in a reserved 16 px slot so text never shifts) | "Invoice", "Issued", "Type", "Total" (sentence case) | Invoices table header |
| 2068 | Clickable `<tr>` | Whole row stays clickable for mouse; invoice number is a real `link`-style button for keyboard/screen reader | Invoice number | Invoices table |
| 2083 | 16 px teal checkbox, compare mode only | `Checkbox` 20 px, hit area 40 × 40, always visible | "Select {number}" (aria-label) | Invoices table, col 1 |
| 2130 | Row Edit icon (grey-400, no padding) | Menu item (and drawer `Button` secondary `md`) | "Edit" | Row ⋯ menu; drawer header |
| 2139 | Row Delete icon | Menu item `destructive`-styled (danger text), last after a divider; drawer `destructive-quiet` `md`, left-aligned | "Delete" | Row ⋯ menu; drawer |
| (new for 2130 / 2139) | — | `IconButton` ghost `sm`, `Ellipsis` | "Actions for {number}" | Last column of each row |
| 2245 | Edit form Cancel (grey) | `Button` ghost `md` | "Cancel" | Drawer edit footer (sticky) |
| 2251 | Edit form Save Changes (blue) | `Button` **primary** `md`; `aria-disabled` + reason until valid ("Total must equal Net + VAT") | "Save changes" | Drawer edit footer (sticky) |
| 2271 | No-match "Clear Filters" (orange text) | `Button` secondary `md` | "Clear all filters" | No-match empty state |
| `Toast.tsx:63` | Toast close ✕ | `IconButton` ghost `sm` | "Dismiss notification" | Toast corner |
| `FileUpload.tsx:63` | Invisible file input over drop zone | Visible `Button` secondary `md` + drop area; real focusable control | "Choose PDFs" | Upload dialog; empty states use `lg` primary "Upload PDFs" |
| `error.tsx:15` | "Try again" (orange, white text 2.8:1) | `Button` **primary** `lg` + `link` | "Try again", "Go to Overview" | Error page |
| (new, not in code today) | — | **Upload PDFs** primary `md` (top bar, shell); Report (PDF) secondary `md` (Analytics: `MenuButton` "This tab / All tabs"); Prev/Next month `IconButton` ghost; Range `SegmentedControl` 6M \| 12M \| All \| Custom; drawer Prev/Next secondary `sm`; Copy ghost `sm` with icon + label; Compare dialog Swap secondary `sm`; Retry / Reload secondary `md`; Reset chart choices secondary `md`; ChartToolbar controls (§4.11); phone `Filters (n)` secondary `md` | per §4 | per §4 |

#### 2.7.11 Visual QA per phase, and the `/dev/ui` gallery

**Gallery route `/dev/ui`** (built in Phase 1, dev only):
- File `app/dev/ui/page.tsx`, **outside** the `(app)` group so it loads no providers and no Supabase. It calls `notFound()` when `process.env.NODE_ENV === 'production'` and sets `noindex`.
- Two panels side by side (stacked below 1024 px): **Light** and **Dark** (the dark panel is a `<div class="dark">` using the same CSS variables), so both themes are reviewed in one screenshot. `?theme=dark` also forces the whole page.
- Contents in each panel: every button variant × size (sm, md, lg) × state (default, hover, active, focus-visible, disabled with reason, loading) — forced with `data-state="hover|active|focus"` selectors that mirror the real pseudo-classes; icon + label, trailing chevron, icon-only with tooltip open, link; `SegmentedControl` (2, 3, 4 items; one disabled with reason; `sm` and `md`); `Tabs`; `ToggleChip` (off, on, with count, removable, type chip with dot); `MenuButton` (closed, open with groups, destructive item, disabled item with reason); `Input` / `Select` / search (default, hover, focus, error, disabled, money suffix, clear button); `Checkbox` (off, on, indeterminate, disabled, focus); `Tooltip` open; page header, filter bar, `ChartToolbar`, selection bar and dialog footers rendered in **375 px and 1440 px wide frames**; Toast with Undo.
- A **contrast table** computed in the page from `getComputedStyle` for each variant/state pair (text ≥ 4.5:1, borders/icons/ring ≥ 3:1) with a pass/fail column; zero failures is required.

**Per-phase visual QA** (added to the §7 definition of done): for every screen a phase changes, take screenshots with the `cdp-browser-automation` skill in **light and dark at 375 px and 1440 px** (the existing 768 / 1024 shots stay). "Screen" includes each state the phase touched (loading, empty, error, populated) and each overlay (open menu, drawer, dialog, bottom sheet). Save under `project_notes/ui-revamp-shots/phase-N/<route>-<state>-<light|dark>-<375|1440>.png`. Review each against this checklist:
1. Only one primary per surface (§2.7.3); no primary in a card, toolbar or table.
2. Every button/control comes from `components/ui/*`. Check: `rg "<button|<select|type=\"checkbox\"" app components --glob "!components/ui/**"` and `rg "(bg|text|border|ring)-(gray|orange|blue|green|red|teal|amber|purple|indigo|emerald)-"` return nothing in migrated files.
3. Controls in one row have the same height; no clipped or wrapped labels at 375 px.
4. Every icon-only control is on the allowed list and shows a tooltip on hover/focus.
5. One screenshot per screen with the keyboard focus ring visible (Tab to the first control) in each theme.
6. Disabled controls show their reason (tooltip and caption).
7. A scripted check, `scripts/ui-audit.mjs` (planned in Phase 1, run through CDP): lists every `button, a, [role], input, select` with size below 24 px (mouse) or hit area below 44 px (375 px, touch emulation), missing accessible name, no visible focus change, and text/border contrast failures. Zero findings, or each one justified in the phase report.

**Gate:** Phase 2 does not start until the `/dev/ui` screenshots (light and dark × 375 and 1440) and the contrast table are reviewed and approved by you. Later phases add their screen shots to the same review but are not gated.

---
## 3. Information architecture

### 3.1 Map

```
App shell (sidebar / bottom nav · top bar · toast region · global drop target)
├── /            Overview           KPIs · monthly costs · this-month breakdown · latest invoices
├── /invoices    Invoices           search + filters · table/cards · row actions · compare · export
│     ├── ?invoice=<id>             Invoice drawer (detail, edit, manual heating)
│     └── ?compare=<id>,<id>        Compare dialog
├── /analytics   Analytics          tabs: Monthly costs · Utilities · Year over year   (?tab=)
├── /data        Data & settings    Manual heating values · Import/Export · Sync · Appearance · Print · Danger zone
└── Upload dialog (opened from top bar, empty states, or by dropping PDFs anywhere)
```

Why routes (not tabs on one page): deep links (`/invoices?invoice=…`), browser Back closes the drawer, each screen has one job, charts load only where needed. State that must survive navigation (invoices, manual values, undo stack, toasts) lives in providers in `app/(app)/layout.tsx`, so moving between screens never refetches.

### 3.2 Where every feature lands

Covered row by row in §1.2 ("New home" column). Summary:

| Destination | Features |
|---|---|
| Global (shell) | F1–F7 upload entry, F44 theme, F45 toasts, F18 `/` search hotkey, F16 Cmd/Ctrl+Z |
| Shared on **every** chart/table (round 2) | F49–F53, F55 via `ChartCard` / `DataPanel` (Chart\|Table, Bar\|Line\|Area, Expand, Export PNG/CSV/PDF) |
| Overview | F25, F26 (as chart + table view), F36 consistent split, F54 Report PDF (Overview) |
| Invoices | F8–F10, F13–F14, F17, F19–F24, F38–F42 (export menu), F42 print; table is a `DataPanel` (F49, F51–F53, F55 — "Chart" = monthly totals of the filtered list) |
| Drawer | F13, F28, F28b, F29, F30 (single-invoice views are **not** `DataPanel`s) |
| Analytics | F31–F35, F37, F54 Report PDF (this tab / all tabs); every chart is a `ChartCard`, every table inside it is its Table view |
| Data | F15, F30 (table, a `DataPanel`), F38–F43, F44, F48 retry |
| Intentionally dropped | F11 (collapse table), F12 ("Table" toggle), F27 (dead running totals) |

### 3.3 Navigation behaviour

| Viewport | Navigation | Top bar | Invoice detail | Table |
|---|---|---|---|---|
| ≥ 1280 | Left sidebar 232 px: logo wordmark, 4 items (icon + label, `Invoices` shows count), bottom: connection status + theme. Collapsible to rail (state remembered). | Page title (h1), Upload button (primary), account-less | Right drawer 640 px over list | Full table |
| 768–1279 | Icon rail 64 px with `aria-label`s and tooltips | Same | Right drawer 560 px | Full table (drops "Issued" → inline under number if < 900 px) |
| < 768 | **Bottom tab bar** (4 items, 56 px + safe-area), no sidebar | Compact: title + **Upload** (icon + short label, not icon-only) + More (§2.7.9) | Bottom sheet (92 dvh, drag handle **and** a Close button — no drag-only) | Card list |

Order of items follows frequency of use: Overview, Invoices, Analytics, Data. The active item has `aria-current="page"`, a 3 px ink marker on the left (rail/sidebar) or top (bottom bar), and `surface-3` background — not colour alone.

---

## 4. Screen-by-screen specs

Shared patterns first, then screens.

### 4.0 Shared patterns

- **Number display** (see §5.4): `fmtMoney(1234.5) → "1 234,50 zł"`; KPIs show whole złoty with grouped digits and the decimals in `ink-muted` smaller: `12 840` `,50 zł`.
- **Type badge**: pill, 8 px colour dot + label in `--ink`, background = type tint. Combined invoice: "Rent + Parking".
- **Delta chip**: `▲ +123,40 zł · +4,2 %` (increase = `--increase`) / `▼ −80,00 zł · −2,1 %` (decrease = `--decrease`). Text always includes the sign and arrow. Costs: up is "bad" colour; neutral `±0` shows `—`.
- **Segmented control** (radio-group semantics) for view modes; **Chips** (toggle buttons with `aria-pressed`) for multi-select. All buttons and controls follow §2.7 (variants, sizes, states, one primary per surface, overflow into "More").
- **Skeletons** match final layout heights (no layout shift); shown while `status === 'loading'`.
- **Errors** are inline (`Banner` with action), never toast-only. Form errors sit under the field, linked with `aria-describedby`.
- **Every chart is a `ChartCard` and every data table is a `DataPanel`** (round 2): the same labelled header toolbar everywhere — Expand and Export on every panel; Chart | Table and chart-type controls wherever the data has a meaningful chart counterpart. This distinction preserves the user's table requirement without inventing misleading charts for single-invoice line items. Specified once in §4.11 and referred to (not repeated) below.

### 4.1 App shell

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ Ledger ▾ │  Overview                                  [Upload PDFs]    │  ← top bar 56px (sticky)
│ ──────── │────────────────────────────────────────────────────────────│
│ ▣ Overview│                                                            │
│ ▤ Invoices 26                (page content, max 1200px)               │
│ ▥ Analytics                                                            │
│ ⛁ Data   │                                                            │
│          │                                                            │
│ ● Synced │                                                            │
│ ◐ Theme  │                                                            │
└──────────┴────────────────────────────────────────────────────────────┘
```
- Skip link "Skip to content" first in tab order. Landmarks: `<nav aria-label="Main">`, `<main id="content">`.
- Connection status: "● Loaded 14:02" (ok) / "● Couldn't load — Retry" (error, `role="status"`).
- Window-wide drop target: dragging files over the window shows a full-screen overlay "Drop PDF invoices to upload" (dashed 2 px ink border, scrim). Releasing opens the Upload dialog with the files queued. Works on every route.

### 4.2 Overview (`/`)

Purpose: "What did I pay lately, and is it going up?" in 5 seconds.

```
Period: ‹  November 2026 ▾  ›                         (defaults to latest month that has invoices)

┌ Total · Nov 2026 ─┐ ┌ Rent + parking ──┐ ┌ Utilities ───────┐ ┌ Year to date ─────┐
│ 6 412,30 zł       │ │ 5 150,00 zł      │ │ 1 262,30 zł      │ │ 61 480,10 zł      │
│ ▲ +104,20 zł +1,7%│ │ Rent 4 700 · Parking 450 │ ▲ +104,20 … │ │ ▲ +5,2 % vs 2025 YTD │
│ vs Oct · 2 invoices│ │ — no change       │ │ vs Oct           │ │ 11 months          │
└───────────────────┘ └──────────────────┘ └──────────────────┘ └───────────────────┘

┌ Monthly costs (stacked)   [6M|12M|All]  [Chart|Table] ┐ ┌ This month by item ──────────┐
│ ▇ bars Jan…Dec, Rent/Parking/Utility; click a bar     │ │ Rent                4 700 zł  —│
│ to change the period above                            │ │ Parking               450 zł —│
│                                                       │ │ Central heating       412 zł ▲│
└───────────────────────────────────────────────────────┘ │ Electricity …                 │
                                                          └───────────────────────────────┘
┌ Latest invoices ──────────────────────────────────────────── View all invoices → ┐
│ FA/MYS/124/11/2026  18 Nov 2026  [Rent + Parking]               5 150,00 zł       │
│ …(5 rows)                                                                          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**KPIs (all via `lib/analytics.ts`, all use `amountsByType` so cards = charts):**
1. **Total — {month}**: sum of gross of invoices whose issue month = selected month. Delta vs previous *month that has data* ("vs Oct"). If the previous month is missing → "No previous month". If previous total is 0 → show absolute change only.
2. **Rent + parking**: sum of Rent + Parking amounts; subline "Rent X · Parking Y". Handles the Nov-2026 combined invoice and the older separate invoices identically. Delta vs previous.
3. **Utilities**: sum of Utility amounts; delta vs previous.
4. **Year to date {year}**: sum from Jan 1 to the end of the selected month for that year; comparison "vs {year−1} same period" if prior-year data exists for those months, otherwise "No {year−1} data for comparison". (Replaces the old YTD *count* card.)
Four cards fit 4-up ≥ 1024, 2×2 on tablets/phones. Each card has an icon, label, value, delta, context line; the whole card is a link to the relevant filtered Invoices view (Total → month; Utilities → Utility + month).

**Monthly costs chart** — stacked bars (Rent bottom, Parking, Utility), last 12 months default; segmented range 6M / 12M / All; rendered as a `ChartCard` (§4.11): Chart | Table view (table = months × Rent/Parking/Utility/Total, replaces F26 "Monthly sums"), Bar (Stacked/Grouped) | Line | Area type switch, Expand, Export (PNG/CSV/PDF). Clicking/Enter on a bar sets the period selector. Y axis compact PLN (`5 tys.`); gridlines horizontal hairlines only.

**This month by item** (replaces nothing; new, small): ranked horizontal list of line-item categories for the selected month (Rent, Parking, Cold Water, Hot Water, Electricity, Central Heating, Waste, Other lines), amount + delta vs previous month. Uses the same matchers as Utilities charts; manual-heating rows excluded and, when the month has a manual value, a note "Heating adjusted by manual value: +X zł moved from Central Heating" (same maths, §1.3-2).

**Latest invoices**: 5 most recent by issue date, same row component as Invoices (clicking opens the drawer on `/invoices`).

States:
- *Loading*: 4 KPI skeletons + chart skeleton (fixed 320 px) + 5 row skeletons.
- *Empty (no invoices)*: panel with 24 px icon, "No invoices yet", one sentence ("Upload the PDF invoices from your landlord. Rent, parking, water, heating, electricity and waste are picked up automatically."), primary **Upload PDFs** button, secondary "Import a JSON backup" link.
- *Load failed*: banner "Couldn't load your invoices from the database. Your data is not lost." + **Retry**.
- *Only 1 month of data*: delta lines say "First month with data"; chart shows the single bar (no line charts on Overview).

**Report (PDF)** (F54): top-bar action "Report (PDF)" generates a one-page report of this Overview snapshot — KPIs, Monthly costs chart, This month by item table, footer with generation date and the active period. Spec in §4.12.4.

### 4.3 Invoices (`/invoices`)

```
Invoices  26                                   [Compare]  [Export ▾]  [Upload PDFs]
┌ sticky filter bar ───────────────────────────────────────────────────────────────┐
│ 🔍 Search number or file…  /    Type: (All 26)(Rent 12)(Parking 4)(Utility 9)(Other 1)   Period ▾ │
│ Active: [Utility ✕] [Jan 2025 – Nov 2025 ✕]                       Clear all      │
│ Showing 9 of 26 · 11 204,10 zł                                                    │
└───────────────────────────────────────────────────────────────────────────────────┘
 ☐  Invoice ↕               Issued ↓        Type          Total               ⋯
 ☐  FA/MYS/124/11/2026      18 Nov 2026     [Rent+Parking]   5 150,00 zł       ⋯
    faktura_fa_mys_124_11_2026.pdf
```

**Filter bar** (sticky below top bar, `e1`):
- Search (F19) — matches invoice number or filename (case-insensitive, same as today). `/` focuses it (only when focus isn't in an input). Clear (✕) button inside.
- Type chips (F20) — single-select radio group with counts; wraps on small screens (never clipped).
- **Period** (F21 + F22) — popover: presets *All time · This year · Last 12 months · Custom*; custom = two selects **From** / **To** built from the months that exist in data (`Jan 2025` …). Choosing the same month in both = old "Month" filter. Old saved `filterMonth` is converted once to From = To = that month (stored as `YYYY-MM` in the existing `dateRangeStart/End` keys, so the saved shape does not change).
- **Active filter chips + Clear all** (F23) — every active filter is visible and removable; fixes hidden state (P5).
- **Result strip**: "Showing 9 of 26 · {sum of gross}" (replaces the old 6-card summary on this screen).
- All filters persist as today in `localStorage['invoice-parser-filters']` and are mirrored to the URL (`?q=&type=&from=&to=`) so a filtered view can be bookmarked; URL wins on load.

**Table (≥ 768)** — the Invoices table is a `DataPanel` (§4.11): it gets the same **Expand to full screen** and **Export** (CSV/PDF) actions as every other table, plus **"Show as chart"** (F55) which switches to the Overview-style stacked monthly chart of *this filtered list* (reuses `StackedBars`). Column spec:

| Column | Content | Notes |
|---|---|---|
| ☐ | row checkbox | Replaces compare *mode*. Max 2 selected; third is `aria-disabled` with helper text "Compare works with two invoices". Header shows nothing (no select-all). |
| Invoice | number in Fira Code (a real `<button>` opening the drawer) + filename muted below | |
| Issued | `18 Nov 2026` (month **and year**) | Sortable; default sort = Issued ↓ (today: unsorted = parsed-at order; see risk R7) |
| Type | Type badge (combined badge for rent+parking invoices) | Sortable |
| Total | right-aligned, tabular, `1 234,50 zł` | Sortable |
| ⋯ | Menu: Open · Edit · Delete | Visible always (touch/keyboard), not hover-only |

- Sortable headers are `<th aria-sort>` containing a `<button>` with arrow icon (F9).
- Whole row is clickable (convenience), the number button is the keyboard/screen-reader target; row hover = `surface-2`, open-in-drawer = `surface-3` + 3 px ink left marker.
- Keyboard (F18): when focus is inside the table, ↑/↓ move focus between rows (roving tabindex), Enter opens, `Space` toggles the checkbox. **No global key capture.**
- **Selection bar** appears (sticky bottom on mobile, inline above table on desktop) when ≥ 1 row is checked: "1 selected — pick one more to compare" / "2 selected · **Compare** · Clear".
- Export menu (F39–F41): *JSON (all invoices)*, *CSV (current list)*, *Excel (current list)*, *PDF (current list, via `DataPanel`'s Export)*; helper text under the menu: "Heating adjustments from manual values are included." Print (F42) lives in the same menu, separate from PDF export (F42 prints the live page; PDF export renders the purpose-built light report, §4.12).

**Phones (< 640):** each invoice is a card: top line number (mono) + Total (right, 17 px 600); second line `18 Nov 2026 · {type badge}`; ⋯ at the right; checkbox on the left. Filter bar collapses to search + a "Filters (2)" button opening a bottom sheet with type chips + period.

**Row actions:**
- **Delete (F14)**: optimistic remove, then toast "Deleted FA/MYS/124/11/2026" with an **Undo** button (8 s). Cmd/Ctrl+Z also undoes (only when focus isn't in a text field). Rollback + error toast if the database call fails (same as today). Keeps the 10-level stack.
- **Edit (F13)**: opens the drawer in edit mode (§4.4).

**States:** *Loading* — 8 skeleton rows. *Empty (no invoices)* — same as Overview empty with Upload CTA. *No matches* — "No invoices match these filters" + the active-filter chips + **Clear all filters**. *Load failed* — banner + Retry. Pagination: none now (≤ a few hundred rows; revisit if > 300 — add "Show 50 more").

F11/F12 (collapse table, hide table) are dropped: the list is the screen.

### 4.4 Invoice drawer (detail, edit, manual heating)

Choice: **drawer over page** — you scan the list and inspect one invoice at a time; the list stays visible, Back closes it, `?invoice=<id>` deep-links. Implemented as a native `<dialog>` (modal) → focus trap, Esc, inert background and top-layer for free; on close, focus returns to the row's number button.

```
┌───────────────────────────────────────────────────────── ✕ ┐
│ [Rent + Parking]                        ‹ Prev   Next ›     │
│ FA/MYS/124/11/2026                      (Fira Code, 20px)   │
│ Issued 18 Nov 2026 · faktura_fa_mys_124_11_2026.pdf  [Copy] │
│ ┌ Total ───────┐ ┌ Net ────────┐ ┌ VAT ────────┐            │
│ │ 5 150,00 zł  │ │ 5 150,00 zł │ │ 0,00 zł     │            │
│ └──────────────┘ └─────────────┘ └─────────────┘            │
│ [Edit]  [Delete]                                            │
│ ─ Dates & payment ──────────────────────────────────────── │
│ Issued 18 Nov 2026 · Sale 18 Nov 2026 · Due 02 Dec 2026     │
│ Payment: transfer · Account PL12 … [Copy]                   │
│ ▸ Parties (seller, NIP, purchaser)                          │
│ ─ Line items ───────────────────  [Compact | Full columns]  │
│ Rent                         1 × 4 700,00     4 700,00 zł   │
│ Parking Rent                 1 × 450,00         450,00 zł   │
│ ─ Manual heating (Utility only) ────────────────────────── │
│ Units for Nov 2026 [ 1.82 ] × 76 = 138,32 zł  [Save][Cancel]│
│ ─ Totals ─ Net … VAT … (manual lines) … Gross …             │
└─────────────────────────────────────────────────────────────┘
```

- **Header** (F28): type badge, invoice number, issued date, filename, total as the hero. Prev/Next steps through the *current filtered + sorted list* (replaces ↑/↓ hotkeys).
- **Dates & payment / Parties** (F28b, new, read-only): shows already-stored fields; `Copy` buttons for invoice number and bank account. Hidden fields with empty values are omitted, not shown as "-".
- **Line items** (F29): *Compact* (default, fits 560 px) = description (with `lang="pl"` when it contains Polish text) + `qty unit × unit price` caption + gross right; *Full columns* = the 7-column table (#, description, qty, unit price, net, tax, gross) in an `overflow-x-auto` wrapper. Central Heating row, when a manual value exists, gets an **"Adjusted −138,32 zł"** pill with an icon (not just a red tint); the added "Manual Heating Calculation (N × 76)" row is labelled "Added manually" with a pencil icon. Same `hasManualHeatingRow` logic: if the stored line items already contain the manual row, don't add another.
- **Manual heating** (F30), only when `invoiceType === 'Utility'`: input (`inputMode="decimal"`, label "Manual heating units for {Mon YYYY}"), live preview "N × 76 = X zł", **Save** (Enter) / **Cancel** (Esc), inline validation (number ≥ 0), explanatory sentence: "Moves X zł from Central Heating into a separate heating line. The invoice total does not change." Saving shows an inline "Saved" confirmation + toast; persisted exactly as today (`saveManualValues`, key `"Mon YYYY"`).
- **Edit mode** (F13): the three stat tiles become inputs (Type select; Net, VAT, Total) with the same linkage rules as today. Validation is inline: "Total must equal Net + VAT (difference 0,03 zł)". Sticky footer **Save changes / Cancel**; Save disabled until valid. Success toast; on failure an inline banner + error toast and the form keeps its values.
- **Delete** in the drawer: same optimistic + Undo toast, then the drawer closes (or moves to Next).
- Phones: bottom sheet, 92 dvh, handle for visual affordance only; explicit Close button; sticky footer for Save in edit mode.

### 4.5 Compare dialog (F17)

Opened from the selection bar. Large dialog (max 960 px; full screen on phones).
- Header: two invoice cards side by side (number, issued date, type badge, filename), "Swap" button.
- **Totals table**: rows Net / VAT / Total; columns A, B, Δ. Δ shows `▲ +123,40 zł (+4,2 %)` / `▼ −…` with the semantics from §4.0.
- **Line items** matched by normalised description (same as today). Columns: Description · A gross · B gross · Δ gross. Rows present on only one side carry a text chip "Only in A" / "Only in B" (not just yellow background). "Details" expander per row shows quantity and unit-price diffs (parity with today's per-row quantity/unit-price lines).
- Phones: A and B stack per row (label A/B in each).
- Close returns focus to the "Compare" button.

### 4.6 Upload flow (F1–F7)

Entry points: top-bar **Upload PDFs** button, empty states, drop anywhere. Opens a modal dialog (`<dialog>`), so errors can't be lost when the page scrolls.

```
┌ Upload invoices ──────────────────────────────────── ✕ ┐
│ ┌ dashed drop zone, min-h 160 ────────────────────────┐ │
│ │   Drop PDF invoices here        [ Choose PDFs ]     │ │
│ │   PDF only · you can pick several at once           │ │
│ └─────────────────────────────────────────────────────┘ │
│ 3 files                                                 │
│ ✓ faktura_fa_mys_124_11_2026.pdf   Saved · FA/MYS/124…  │
│ ⟳ faktura_zzz.pdf                  Reading…             │
│ ⧗ scan.pdf                         Waiting              │
│ ⚠ old.pdf        Already saved (FA/MYS/289/01/2026) Open│
│ ✕ broken.pdf     Couldn't read this file · Details  Retry│
│ ✕ notes.txt      Skipped — not a PDF                     │
│                          2 saved · 1 duplicate · 1 failed │
│                              [Retry failed]  [Done]       │
└───────────────────────────────────────────────────────────┘
```
- **Drop zone** is also a real button ("Choose PDFs") — no drag-only path. Keyboard: Enter/Space on the zone opens the picker. `Drop` highlights with `--focus` dashed border + "Release to add".
- **Queue**: every selected file becomes a row with an icon + text status (not colour alone): Waiting → Reading… → Saved / Already saved / Failed / Skipped. Non-PDFs are listed as skipped instead of vanishing (fixes F2/P14).
- **Progress**: preferred = one request per file to `/api/parse` (same endpoint/field name `files`, concurrency 2) so each row has a real state; then save to Supabase sequentially exactly like today (`addInvoice`). *To confirm in Phase 5*: that `route.ts` handles a single-file `FormData`. Fallback = one request for all files with row spinners and the summary at the end.
- **Duplicates** (F4): same key (`invoiceNumber-issueDate`) vs stored invoices and earlier files in the same batch → row "Already saved (FA/…)" with an **Open** link; nothing written.
- **Parse sanity warnings** (new, display-only): after a successful parse, flag "Saved — check this one" when `issueDate` is empty (month would show `-`), invoice number is `Unknown`, gross total is 0, or there are no line items. Row has a **Review** button that opens the drawer. This would have caught the Nov-2026 problem immediately.
- **Summary + actions**: counts line, **Retry failed** (re-sends only failed files), **Done**. Closing the dialog with failures left raises a persistent error toast ("1 file couldn't be read: broken.pdf") with **Upload again**.
- Success path: if everything saved, auto-focus **Done**; announce summary via `aria-live="polite"`.
- Save failure ("Failed to save some invoices to database", F6) is a row-level "Couldn't save — Retry" state, not a generic toast.

### 4.7 Analytics (`/analytics`, tabs via `?tab=`)

Shared controls (top of page, sticky): **Range** segmented `6M · 12M · All · Custom` (custom = From/To selects). Analytics has its own range and **ignores the Invoices list filters** (today charts ignore search/date and disappear on type/month filters — P6); a small caption says "Charts use all invoices in the selected range." Top-bar action **Report (PDF)** exports the current tab (or, via a small menu, all three tabs) — spec in §4.12.4.

Every chart on this page is a `ChartCard` and every table (including the ones nested inside a chart's Table view) is a `DataPanel`. The full shared toolbar spec — Chart|Table, Bar|Line|Area, Expand, Export — lives in **§4.11**; this section only adds chart-specific content.

Chart content rules (beyond the shared toolbar):
- `<figure>` with title (h2), optional subtitle, and an `sr-only` text summary ("Utilities cost rose from 1 158 zł in Oct to 1 262 zł in Nov").
- Axes: no rotated labels — x ticks `Nov ’25` with `interval="preserveStartEnd"` and fewer ticks on phones; y ticks compact PLN (`1,2 tys.`); horizontal hairline grid only; ticks 12 px `--ink-muted`.
- One shared `ChartTooltip` (money/quantity/unit aware, swatch + label, `--surface` background, `e2`). Keyboard: Recharts 3 `accessibilityLayer` enabled so arrow keys move through data (verify in Phase 4a).
- Bars: radius `[3,3,0,0]`, stacked segments separated by 1.5 px surface stroke. Series toggles = legend chips (`aria-pressed`).
- Lazy loaded (`next/dynamic`, `ssr:false`) with a fixed-height skeleton.
- Empty: "No invoices in this range" + "Reset range". Months with no invoice show as gaps (value 0 rendered as an empty slot, tooltip says "No invoice").

**Tab 1 — Monthly costs** (replaces F31's 3 charts):
- Segmented **Stacked | Separate scales** (content choice, independent of the chart-*type* switch in §4.11.3 — Bar/Line/Area still applies on top of this).
  - *Stacked*: Rent / Parking / Utility per month + total label above each bar.
  - *Separate scales*: three small multiples (Rent, Parking, Utility), each with its own y-axis — needed because rent (thousands) dwarfs parking (hundreds), which is why the old app had three charts.
- Table view (F49/§4.11.2): Month · Rent · Parking · Utility · Total · Δ vs previous month. Export, Expand, PDF as usual.

**Tab 2 — Utilities** (replaces F32–F34, 15 charts → 1 control set + 5 mini charts):
- **Metric** segmented: **Cost (gross, PLN)** · **Usage (quantity)** · **Unit price (avg gross per unit)** — same calculations as F32/F33/F34, manual heating rows excluded (F37), heating *unadjusted* as today.
- Default view = **5 small-multiple `ChartCard`s** (Cold Water, Hot Water, Electricity, Central Heating, Waste): title + icon, latest value with delta vs previous month, 12-month chart in the sub-type colour, unit caption (m³ / kWh / GJ / PLN). At compact dashboard width their toolbar wraps into two rows; it is never hidden. The same card expands to its full view without a separate "view" affordance.
- **Expand** on a card opens the full `ChartCard` (§4.11.5): full-width chart, min/average/max stats, Table view, and the full toolbar (type switch, export, fullscreen already active).
- For *Cost*, an optional top card "All utilities" (stacked bars of the 5 sub-types) shows composition (new, small) — also a `ChartCard`.
- *Waste Management* is a flat monthly fee (unit "UNIT", quantity 1), so it is hidden from **Usage** and **Unit price** with a note "Billed as a flat monthly fee" (it only produced meaningless flat charts before); its Line option is correspondingly irrelevant there too.
- Units: Cold/Hot Water m³, Electricity kWh, Central Heating GJ (taken from the line item's `unit`; falls back to blank).

**Tab 3 — Year over year** (replaces F35):
- Type select: **Utility** (default, = today) · Rent · Parking · Total. Metric: Cost.
- Default chart type = Line (one line per year, same hue, fading with age; see §2.2, end-of-line labels); Bar (grouped by month, one colour per year) is the alternative via the same §4.11.3 switch. If the selected comparison has < 4 populated month observations overall, Line is disabled with the standard reason and Bar is selected. If Line is valid overall but an individual year has gaps, that year's missing observations render as gaps/dots, not a misleading connected line.
- Table view: Month · {year columns} · Δ vs previous year (value + %).
- Fewer than two years with overlapping months → empty state: "Year-over-year needs the same month in two different years."

### 4.8 Data & settings (`/data`)

Single column of cards with a sticky in-page contents list on ≥ 1024.

1. **Manual heating values** (F30, a `DataPanel`): table of every month that has a Utility invoice — Month · Units (input) · × 76 = Adjustment (read-only) · status ("Saved ✓"). Edit in place, Enter/blur saves, Esc reverts. Rate caption: "Rate: 76 zł per unit" (read-only; see open question 4). Empty state: "No Utility invoices yet." Export (CSV/PDF) and Expand available like any `DataPanel`; "Show as chart" (F55) plots Units per month.
2. **Import / Export** (F38–F41):
   - *Import JSON*: pick a file → **preview step** ("26 invoices found · 3 already exist · 23 new") → **Import 23** / **Replace the 3 existing too**. Fixes P21 by de-duplicating state by `id` and by `invoiceNumber+issueDate`.
   - *Export*: JSON (all), CSV (all), Excel-compatible (`.xls`, all), **PDF (all, via the shared report generator, §4.12.4)**. Note: adjustments included.
3. **Sync** (F43, F48): status ("All changes are saved to the database automatically · last loaded 14:02"), buttons **Reload from database** (re-runs `loadInvoices` + `loadManualValues`) and **Save manual values now** (the old "Save Session").
4. **Appearance**: Theme segmented *System · Light · Dark* (default System; migrates the old boolean). Table density *Comfortable · Compact* (row 52 / 40 px). **Default chart type** per-kind preference reset: "Reset all chart/table view choices to defaults" (clears the `localStorage` keys from §4.11.3).
5. **Print** (F42): "Print invoice list" button; the print stylesheet hides shell/nav/buttons, shows the filtered table + totals, and keeps charts hidden by default (as today). Distinct from the PDF **Report** exports (§4.12), which render a dedicated light-themed document rather than the live page.
6. **Keyboard shortcuts**: `/` search · `Esc` close · `↑ ↓ Enter Space` in the table · `Cmd/Ctrl+Z` undo · `Cmd/Ctrl+Shift+F` toggle a focused chart/table full screen (§4.11.5).
7. **Danger zone** (F15): "Delete all invoices" → dialog: "Delete all 26 invoices? Manual heating values are kept. You can undo right after." Buttons: **Delete 26 invoices** (danger) / Cancel. Success toast has **Undo**.

### 4.9 Toasts (F45)

Rebuilt as `ToastProvider` + `useToast()` (`toast.success/info/warning/error`, optional `action`).
- Surface style: `--surface` background, 1 px border, 3 px left bar in status colour, status icon + ink text (no white-on-saturated). Contrast ≥ 4.5:1.
- Placement: bottom-right on desktop; bottom-centre above the tab bar on phones. Max 3 visible; newest on top.
- Timing: success/info 4 s, warning 6 s, **error persists until dismissed**; Undo toasts 8 s. Pause on hover and on keyboard focus.
- A11y: region `aria-live="polite"`; error toasts `role="alert"`; close button `aria-label="Dismiss notification"`; action button is focusable.
- Motion: slide-up 240 ms; reduced motion = fade only.

### 4.10 Global empty / loading / error states

| State | Treatment |
|---|---|
| First load | Skeletons in final layout; shell renders immediately |
| No invoices | Illustrated-free empty panel: icon, one sentence, Upload CTA, Import link |
| No filter matches | Message + visible active filters + Clear all |
| Load failed | `Banner` (danger tint) "Couldn't load your invoices… Your data is not lost." + Retry; nav status turns to error |
| Save failed | Inline where the action happened + persistent error toast |
| Route error (`app/error.tsx`) | Restyled: heading, message, **Try again**, link home |
| 404 | `not-found.tsx` with link to Overview |

### 4.11 Shared chart/table toolbar — `ChartCard` and `DataPanel` (round 2)

This is the single most-reused spec in the plan. **Every** chart in §4.2/§4.7 and **every** table in §4.3/§4.7/§4.8 is one of these two components. They share one toolbar implementation (`ChartToolbar`) and differ only in what sits below it (a chart vs a `<table>`).

```
┌ ChartCard: "Utilities → Cost → Central Heating" ───────────────────────────────┐
│ Central Heating — cost by month                              [ ⤢ ]  [ ⋯ Export ]│
│ [ Chart ●| Table ]        [ Bar ▾ ]  (Stacked · Grouped · Line · Area)          │
│ ┌──────────────────────────────────────────────────────────────────────────┐  │
│ │                         (chart or table render area)                     │  │
│ └──────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 4.11.1 Anatomy
- **Header row**: title (h2/h3 depending on nesting level), optional subtitle/caption, then two icon-with-label buttons pinned right: **Expand** (`⤢`, label "Full screen") and **Export** (`⋯`, label "Export", opens `ExportMenu`). Both are `secondary sm` buttons (§2.7). Below 640 px they collapse into one labelled **More ▾** menu (Full screen, Export PNG / CSV / PDF) and the Chart | Table and Bar | Line | Area controls take the full row (§2.7.9). The "Bar ▾" select in the sketch below is built as Bar | Line | Area plus a "Stacked" chip (§2.7.6).
- **View row**, directly under the header, always visible, always text-labelled (never icon-only per the skill's "no emoji/ambiguous icon as the only label" and the user's requirement):
  - **Chart | Table** segmented control (`ViewSwitch`) — F49.
  - **Chart-type select** (`ChartTypeSwitch`) — F50 — visible only while "Chart" is selected and only on charts that have more than one valid type (a few, like "This month by item", stay single-type and simply omit this control).
  - **"Show as chart"** link (F55) appears instead of the above on tables that do *not* have a dedicated chart counterpart but do have one computable (e.g. the Invoices list "Showing 9 of 26" result → "Show as chart" switches the whole `DataPanel` into Chart mode using an on-the-fly monthly aggregation of the *currently filtered* rows).
- **Content area**: the chart (Recharts) or the table (`<table>`), at a fixed min-height so switching views doesn't jump the page.

#### 4.11.2 `DataPanel` (tables) vs `ChartCard` (charts)

| | `ChartCard` | `DataPanel` |
|---|---|---|
| Used for | Monthly costs, Utilities mini-charts, YoY, This-month-by-item | Invoices table, monthly table, YoY table, utilities tables, manual-values table |
| Default view | Chart | Table |
| `Chart \| Table` switch | Yes — Table view renders the same data as a `<table>` (reuses `DataPanel` internally) | **Always visibly present**. If a `chartSpec` is supplied (F55), both options work; if no meaningful time-series chart exists (invoice line items, comparison rows), the labelled **Chart** option is disabled with the reason "This table has no time-series view", while Table remains active. |
| `Bar \| Line \| Area` switch | Yes, per §4.11.3 | Only visible once the panel is switched to Chart mode (then it behaves exactly like a `ChartCard`) |
| Export | PNG (chart render) + CSV (underlying rows) + PDF | CSV + PDF (no PNG — there's no chart pixel to rasterize until "Show as chart" is active, at which point PNG also appears) |

Both are thin wrappers around one internal `useDataView({ data, chartSpec, tableSpec, storageKey })` hook so the behaviour (persisted choice, fullscreen, export) is implemented once.

#### 4.11.3 Chart-type switch — rules

Options, in order: **Bar (Stacked)** · **Bar (Grouped)** · **Line** · **Area** (Area only offered when the data is inherently a running/stacked quantity — Monthly costs and "All utilities" — not for single-series mini-charts, where Area adds nothing over Line).

- **≥ 4 point rule**: `Line` and `Area` are disabled (visually dimmed, not hidden — removing a control users expect is worse than disabling it) whenever the current range has fewer than four **actual populated observations**. Padded empty month slots do not count. The disabled option keeps a tooltip/`title` and an `aria-describedby`'d reason: *"Line needs at least 4 months with data — you have {n}. Showing as bars instead."* Bars have no such restriction (the skill's chart-type data table only disallows Line below 4 points, not Bar).
- **Per-chart memory** (F49–F50): each `ChartCard`/`DataPanel` has a stable `storageKey` assigned in §4.11.6 (e.g. `overview.monthly-costs`, `analytics.utilities.cost.cold-water`). The full choice `{ view: 'chart'|'table', chartType: 'bar-stacked'|'bar-grouped'|'line'|'area' }` is written to `localStorage['invoice-parser-chart-prefs']` as `{ [storageKey]: choice }` via `hooks/useChartPrefs.ts`. If the remembered type is currently disabled (e.g. range shrank below four observations), fall back to Bar (Stacked) for that render only — the remembered preference is not overwritten, so it returns once enough points are back.
- Switching the type does not change the Chart/Table toggle's state, and does not reset the user's chosen range/metric segmented controls.
- A11y: implemented as a `<select>`-like button exposing `role="radiogroup"`/`radio` items (or a native `<select>` — simpler, equally compliant) with the reason exposed via `aria-describedby`, not colour alone. The same disabled-with-reason treatment applies to a DataPanel's Chart option when its rows do not form a time series.

#### 4.11.4 Export menu — placement and contents

`ExportMenu` is one menu button (`⋯ Export`) with a short, fixed set of items depending on what the panel is showing:

| Panel is showing | Menu items |
|---|---|
| `ChartCard`, Chart view | **PNG (image)** · **CSV (chart data)** · **PDF (chart page)** |
| `ChartCard`/`DataPanel`, Table view | **CSV (table)** · **PDF (table page)** |
| Page-level ("Report") | See §4.12.4 — a different, page-scoped action, not part of this per-panel menu |

Every export item is a real menu item with text (no icon-only rows), disabled with a reason while data is loading or empty ("Nothing to export yet"). CSV and PNG download immediately; PDF opens the browser print dialog pre-scoped to this panel (§4.12.2) so the user picks "Save as PDF".

#### 4.11.5 Full screen (`FullscreenDialog`)

- Implementation: a `<dialog>`-based modal is the **primary** mechanism (reliable focus trap, Esc-to-close, inert background, works identically across browsers and on mobile Safari where the Fullscreen API is unsupported on non-video elements). The **Fullscreen API** (`element.requestFullscreen()`) is attempted first only as a progressive enhancement *in addition to* the dialog (so true OS-level fullscreen is used when available, e.g. desktop Chrome/Firefox/Edge); if `document.fullscreenEnabled` is false or the call rejects, the dialog alone is already a complete, correct full-screen experience — there is no degraded path.
- Layout inside: toolbar stays pinned at the top (same `ChartToolbar`, all controls remain available — expanding doesn't lose the ability to switch chart type or export). Below it: chart **and** table — side-by-side at ≥ 1024 px (chart left ~60%, table right ~40%, independently scrollable), stacked chart-above-table below that. On mobile **landscape** specifically (the user's explicit ask), the dialog uses the same stacked layout with a wide, full-viewport chart and the table below; it does not attempt `screen.orientation.lock` (unreliable/permission-gated), but works correctly in either current orientation and shows "Turn your phone sideways for a bigger view" only in portrait on phones.
- Esc closes (both the dialog and, if active, native fullscreen — exiting one exits the other via the `fullscreenchange` listener). Focus returns to the Expand button that opened it.
- Closing resets nothing: the Chart/Table and chart-type choices made while expanded persist to the normal (non-expanded) card.

#### 4.11.6 Applying this to every existing chart/table (mapping)

| Screen item | Component | Chart types offered | Has "Show as chart" |
|---|---|---|---|
| Overview → Monthly costs | `ChartCard` (`overview.monthly-costs`) | Bar(S/G), Line, Area | — |
| Overview → This month by item | `ChartCard` (`overview.month-breakdown`; bar-only) | Bar(G) only | — |
| Overview → Monthly sums table | `DataPanel` inside the card (`overview.monthly-costs`) | inherited | n/a (it is the chart's Table view) |
| Invoices → table | `DataPanel` (`invoices.filtered-monthly`) | n/a until switched | Yes (F55, monthly aggregation of filtered rows) |
| Invoice drawer → line items | `DataPanel` (`invoice.{id}.line-items`) | none | No meaningful time-series; Expand + CSV/PDF still supplied |
| Compare dialog → totals/line-items | `DataPanel` (`compare.{idA}.{idB}`) | none | No meaningful time-series; Expand + CSV/PDF still supplied |
| Analytics → Monthly costs | `ChartCard` ×1 (`analytics.monthly.stacked`) + ×3 (`analytics.monthly.rent|parking|utility`) | stacked: Bar(S/G), Line, Area; single series: Bar(G), Line | — |
| Analytics → Monthly costs table | `DataPanel` inside the cards | inherited | n/a |
| Analytics → Utilities cards ×5 | `ChartCard` (`analytics.utilities.{metric}.{type}`) | Bar(G), Line (Area omitted — single series) | — |
| Analytics → Utilities "All utilities" | `ChartCard` (`analytics.utilities.cost.all`) | Bar(S/G), Line, Area | — |
| Analytics → YoY | `ChartCard` (`analytics.yoy.{type}`) | Line (default), Bar(G) | — |
| Analytics → YoY table | `DataPanel` (`analytics.yoy.{type}`) | inherited | n/a (it is the chart's Table view) |
| Data → Manual heating values | `DataPanel` (`data.manual-heating`) | n/a until switched | Yes (Units per month) |

### 4.12 PDF export

#### 4.12.1 Approach comparison

| Approach | Dependency weight | Chart fidelity | Polish chars (ł ą ś ć ę ż ź ń ó) | Table pagination | Dark→light for print |
|---|---|---|---|---|---|
| **A. Print pipeline**: render a hidden, light-themed, print-only DOM subtree (`#print-root`) that mirrors the panel/page, then `window.print()` → user picks "Save as PDF" | **None** (uses the OS/browser's built-in PDF writer) | **High** — Recharts SVG usually prints as vector in Chrome/Safari; verify on the supported browsers rather than promise this universally | **Strong** — same `<text>`/`<p>` elements and loaded Fira Sans/Fira Code latin-ext webfonts; verify print preview, no re-encoding step | **Strong** — native CSS `break-inside`/`break-after` and repeated `<thead>`; browser pagination still needs visual testing | Direct — the print subtree is authored in light-mode tokens directly, independent of the on-screen theme |
| **B. `jsPDF` + `html2canvas`** | ~210 KB + ~50 KB min+gzip | **Poor** — `html2canvas` rasterizes to a bitmap at a fixed DPI; SVG chart lines blur/pixelate on zoom, and gets a file-size penalty from embedding a bitmap of every page | Workable but brittle — `html2canvas` needs the font already painted on screen at capture time and can mis-measure latin-ext glyph widths; known community issues with diacritics clipping | Manual — you must compute page breaks yourself (measure content height, slice canvases) | Must explicitly re-theme the DOM to light before capture, same work as A but still ends in a bitmap |
| **C. `@react-pdf/renderer`** | ~450 KB+ min+gzip (own layout/text engine, bundles Yoga) | Must **rebuild every chart as a second, PDF-specific component** (its own primitives, not simply "reuse Recharts") — real but duplicated effort | Needs an explicit embedded font file (`Font.register`) with the exact glyph subset; doable but one more asset pipeline, and the whole rest of the app's fonts/styles aren't reused | Good — has real flow layout with page breaks | N/A — it's an independent render tree, so "theme" is just whatever colours you pass in |

**Decision: Approach A (print pipeline).** It has zero new dependencies, reuses the exact charts/fonts already in the app (no duplicate PDF-only components to maintain), retains vector SVG output in the browsers we will support/test, and Polish diacritics remain browser-rendered text. Its real limitations are that the user confirms "Save as PDF" in the native dialog and browsers vary in PDF tagging/page counters; both are acceptable for a personal tool and explicitly tested/documented in §4.12.2–§4.12.3.
PNG export (for charts, F52) is **not** part of this comparison — it is solved separately and cheaply: Recharts renders SVG, so PNG = serialize that `<svg>` (with computed colours resolved, not CSS variables) → await decoded image → draw to an offscreen `<canvas>` → `canvas.toBlob('image/png')`. `lib/png.ts` fetches the matching **latin-ext** Fira Sans/Code woff2 files from `public/fonts/`, inlines the actual generated font-family/weight as base64 `@font-face` inside the export SVG, then rasterizes (canvas does not inherit the page's `next/font` CSS). No dependency either.
Re-evaluate only if a real "one-click file download, no print-dialog step" PDF becomes a hard requirement — at that point Approach C is the correct second choice (not B), because B's bitmap charts are a strict quality regression from what Recharts already gives us for free.

#### 4.12.2 How the print pipeline works (implementation sketch, for later phases — no code written yet)

1. `lib/pdf.ts` exports `exportPanelToPdf(panelId)` / `exportReportToPdf(reportId)`.
2. On call: a portal renders the **print-only** version of just that panel (or the whole report) into an off-screen, `aria-hidden` container styled entirely from light-mode tokens (§2.2 light column), independent of the user's current theme — "Dark-mode-to-light for print" is solved by *not* inverting dark CSS at all, but by rendering a second, purpose-built light tree.
3. Before printing, `lib/pdf.ts` adds `data-print-export="true"` to `<html>` (a body-level state that the global `@media print` rules can actually see) and exits native fullscreen/closes or suppresses an open `FullscreenDialog`; the scoped print rules then hide every non-`#print-root` sibling and reset the print root from off-screen positioning to visible flow. After print/cancel, `afterprint` removes the attribute, restores the prior dialog/fullscreen state when possible, and returns focus to the Export button. This explicit lifecycle avoids printing a top-layer dialog/backdrop by accident.
4. `await document.fonts.ready` (plus the explicit Fira Sans/Code glyph-load from §2.3) ensures Polish diacritics are painted before printing.
5. `window.print()` is called; the browser shows its print dialog with "Save as PDF" / a physical printer, already scoped to `#print-root`'s content via `@page` margins (see layout below).
6. On the dialog closing (`afterprint` event), the portal unmounts and the app returns to its normal (possibly dark) view — this is instantaneous and never alters the visible app state before/after except the intentional fullscreen exit described in step 3.
7. Table pagination is handled by plain CSS on the print table: `tr { break-inside: avoid }`, `thead { display: table-header-group }` (repeats the header on every printed page) — same mechanism already partially present in `globals.css:42-105`, now scoped correctly instead of targeting the whole page.

#### 4.12.3 PDF/PNG layout spec

**Single chart/table PDF** (from `ExportMenu` → PDF):
```
┌ Invoice Parser — {Panel title}                               ┐
│ {subtitle, e.g. "Central Heating — cost by month"}            │
│ Range: {From} – {To}   ·   Filters: {active filter summary}   │
│ ──────────────────────────────────────────────────────────── │
│ {chart, rendered at print width, or table with repeating head}│
│ ──────────────────────────────────────────────────────────── │
│ Generated {date, time} · Invoice Parser                       │
└────────────────────────────────────────────────────────────────┘
```
Page: A4, portrait by default (landscape auto-selected via `@page { size: A4 landscape }` for wide tables like the Invoices list or multi-year YoY tables — decided by a `wide: boolean` flag per panel, not left to the user). Margins 18 mm. Title in Fira Sans 600 18pt; body 10–11pt; footer 8pt `--ink-subtle`-equivalent light-mode grey, left "Generated {ISO date} {HH:mm}", right "Invoice Parser". Browser page-number counters are not reliable across Chrome/Safari/Firefox, so **do not promise or emulate `Page 1 of 2`** in v1; the browser's own print UI/pagination supplies page counts where it supports them. The generated document is readable semantic HTML, but browser-produced PDFs are not guaranteed tagged/accessible PDFs — the app's accessible Table view remains the accessibility fallback.

**PNG** (chart only): same chart render, 2× pixel density (for retina-quality sharing/paste), transparent background optional via a toggle in the export menu's confirm step (default: `--surface` light background, since a transparent PNG pasted into most apps looks broken); filename `invoice-parser-{panel-slug}-{yyyy-mm-dd}.png`.

**CSV**: unchanged generator from Phase 0 (`lib/export.ts`), BOM-prefixed, same column sets as the panel's Table view; filename `invoice-parser-{panel-slug}-{yyyy-mm-dd}.csv`.

#### 4.12.4 Report PDF (whole page) — F54

A second, page-scoped export, distinct from per-panel export:
- **Overview → "Report (PDF)"**: Title "Invoice Parser — Overview Report", the active period, all 4 KPI cards (as a 2×2/4×1 grid of simple boxes, no interactive chrome), Monthly costs chart (Stacked, whatever range was selected on screen), This month by item table, footer as above. One page typically; KPI+chart always kept together (`break-inside: avoid` on the whole block above the table).
- **Analytics → "Report (PDF)"**: a small menu — *This tab* / *All tabs*. *This tab* renders that tab's chart(s) + its table, same header/footer pattern. *All tabs* concatenates Monthly costs → Utilities (5 mini-chart grid, 2 per row) → Year over year, each starting on its own page (`break-before: page`), with one shared cover line ("Invoice Parser — Analytics Report · {range}") instead of three separate headers.
- **Data → Export → PDF (all)**: the full Invoices table (F39/F53) plus the manual-heating-values table, each a new page.
- Every Report PDF reuses the **same** `#print-root` mechanism, light tokens, font-ready wait, and footer as §4.12.2 — it is simply a bigger panel made of several smaller ones laid out in sequence, not a different code path.

---
(Amounts in the wireframes above are illustrative.)

## 5. Accessibility & formatting

### 5.1 Targets and checks

| Area | Requirement | How it is met / checked |
|---|---|---|
| Text contrast | ≥ 4.5:1 (body), ≥ 3:1 (≥ 24 px / bold ≥ 18.5 px) | Token table in §2.2 (all computed). Toast/chip/badge text always `--ink` on tinted surface. Re-measure the *composed* colours of selected-row, scrim and tints in Phase 1 with a script. |
| Non-text contrast | ≥ 3:1 for input borders, icons that carry meaning, focus ring, chart marks | `--control-border` 3.2/3.8:1; chart series ≥ 3.3:1 (§2.2); focus ring 6.7/7.3:1 |
| Colour is not the only signal | Every colour-coded item has text/icon/shape | Type badges have labels; deltas have ▲▼ and signs; chart series have legend labels + dash patterns/hatch; "Only in A/B" chips; status rows have icons |
| Keyboard | Everything operable by keyboard, logical order, no traps | Native `<button>`, `<a>`, `<dialog>`; table sort buttons inside `<th>`; row roving focus; tabs follow ARIA tab pattern (←/→, Home/End); menus: Arrow keys + Esc + focus return; no global key capture except `/` (not in inputs) and Cmd/Ctrl+Z (not in text fields) |
| Focus visibility | Visible, not obscured | Global `:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px }`; sticky filter bar/top bar get `scroll-margin-top`/`scroll-padding-top` so focused rows aren't hidden under them; no `outline: none` without replacement |
| Dialogs/drawer | Modal semantics, focus management | `<dialog>` + `aria-labelledby`; focus to heading/close on open; return focus to trigger on close; Esc closes; background inert; unsaved-edit guard ("Discard changes?") |
| Forms | Labels, errors, help | Visible `<label>` for every input; `inputMode="decimal"` for money; errors under field, `aria-invalid` + `aria-describedby`; no validation via toast only (today F13 uses toast `page.tsx:822-831`) |
| Tables | Semantics | `<table>`, `<th scope="col">`, `aria-sort`, `<caption class="sr-only">`; numeric columns right-aligned with `tabular-nums`; mobile card list uses `<ul>` with equivalent content |
| Charts | Text alternative, no mouse-only data | `<figure>` + `<figcaption>`, `sr-only` summary, "Chart | Table" toggle (table is the accessible equivalent), Recharts `accessibilityLayer`, tooltips on focus |
| **Shared toolbar controls (round 2)** | Every added control stays keyboard/AT-operable | `ViewSwitch` and `ChartTypeSwitch` use native `<button role="radio">`/`<select>` semantics with visible text labels (never icon-only, per the user's explicit requirement); disabled Line/Area option exposes its reason via `aria-describedby`, not title-only; `FullscreenDialog` reuses the Dialog a11y pattern above (focus trap, Esc, return focus) whether or not the native Fullscreen API also engaged; `ExportMenu` items are real, labelled menu items, each independently disable-with-reason when there is no data |
| **PDF/print export (round 2)** | Exported document is readable, not just the live app frozen | Print-only tree (§4.12.2) is authored directly in light-mode tokens with real semantic HTML (`<table>`, headings), so it inherits the same table/heading accessibility as the screen version; it is not a screenshot |
| Live regions | Announce async results | Toast region `aria-live="polite"` (`role="alert"` for errors); upload summary `aria-live="polite"`; connection status `role="status"` |
| Motion | Respect user setting | `@media (prefers-reduced-motion: reduce)` zeroes durations/transforms; Recharts animation off via `useReducedMotion()` |
| Reflow / zoom | Works at 320 px and 200 % zoom | Mobile card layout; no horizontal page scroll (tables that must scroll do so inside `overflow-x-auto` with visible scrollbar/gradient cue) |
| Targets | ≥ 44 × 44 CSS px on touch, ≥ 24 × 24 minimum on desktop | Buttons `sm` 32 / `md` 40 / `lg` 48 px on mouse; on touch `md` 44, `sm` 36 visual with 44 px hit area (`::after`); checkbox cell 40 / 44; bottom-nav items 56 px (§2.7.3). `scripts/ui-audit.mjs` checks it |
| **Buttons & controls (§2.7)** | Name, role, state and reason for every control | `IconButton` requires `label` (type-level); disabled uses `aria-disabled` + required reason (`aria-describedby`, tooltip, visible caption for touch); menu buttons expose `aria-haspopup` / `aria-expanded`, arrows / Home / End / type-ahead / Esc / focus return; toggles use `aria-pressed`; segmented control is a radiogroup with roving focus; loading sets `aria-busy` and announces the result; tooltips are dismissible (Esc), hoverable and persistent; no outside-click overlay divs; inputs 16 px on phones; focus ring on every control in both themes |
| Language | Correct language for AT | `<html lang="en">`; Polish line-item text wrapped in `lang="pl"` |
| Drag | Single-pointer alternative | "Choose PDFs" button next to the drop zone; bottom sheet has a Close button |
| Print | Readable on paper | Print stylesheet, black on white, no sticky UI |

### 5.2 Test plan for accessibility (per phase, §7 definition of done)

1. Tab through the changed screen with keyboard only; confirm focus order and visible ring in both themes.
2. Screen-reader smoke test (VoiceOver on macOS): nav landmarks, table headers, drawer open/close, toast announcement, chart summary.
3. Browser devtools accessibility pane / axe browser extension: zero critical/serious issues on each route.
4. 200 % zoom and 320 px width; OS "Reduce motion" on; forced light + forced dark.
5. Contrast spot checks of any colour not in §2.2.
6. Run `scripts/ui-audit.mjs` (target size, accessible name, focus change, contrast) and the §2.7.11 screenshot checklist on the changed screens.

### 5.3 Dark mode specifics
Dark tokens are designed separately (not inverted): lighter surfaces for elevation, series colours lifted to ≥ 6.9:1 on `--surface`, borders `#2A323D`, scrims `rgb(0 0 0 / .6)`. First paint has the right theme: an inline script in `<head>` reads `localStorage['invoice-parser-theme']` (values `system|light|dark`; legacy `invoice-parser-dark-mode` = `'true'` migrates to `dark`) and sets `class="dark"` + `color-scheme` before hydration; `<html suppressHydrationWarning>`.

### 5.4 Number, currency and date formatting (single module `lib/format.ts`)

| Need | Rule | Example |
|---|---|---|
| Money | `Intl.NumberFormat('pl-PL', {style:'currency', currency: invoice.currency (PLN), useGrouping:'always'})` — non-breaking space before `zł`; `always` forces `1 234,50 zł` (Polish default groups only from 5 digits, which makes columns misalign) | `1 234,50 zł` |
| Money in KPIs | whole złoty large, `,50 zł` small & muted | **12 840** ,50 zł |
| Signed delta | `signDisplay:'exceptZero'`, real minus `−` (U+2212), arrow glyph, percent with one decimal | `▲ +123,40 zł · +4,2 %` |
| Chart axes | compact (`notation:'compact'`, pl → `1,2 tys.`) — verify in target browsers; fallback `÷1000` + "tys." | `5 tys.` |
| Quantities | `pl-PL`, up to 3 decimals, unit after: `1,82 GJ`, `12,400 kWh` | |
| Dates | Display `18 Nov 2026` (`en-GB`, UTC to avoid timezone shift); keep the stored `DD/MM/YYYY` string untouched | |
| Month labels | keep `"Nov 2026"` keys for storage/manual values; display as `Nov 2026` (tick: `Nov ’26`) | |
| Alignment | `font-variant-numeric: tabular-nums` and right-align in all numeric columns | |
| Locale switch | `LOCALE_NUM` / `LOCALE_DATE` constants at the top of `lib/format.ts` (open question 1) | |

---

## 6. Component architecture & setup

### 6.1 Target file structure

```
app/
  layout.tsx                  fonts (next/font), theme init script, <html lang="en" suppressHydrationWarning>
  globals.css                 tokens (@theme inline), base, focus ring, reduced-motion, print
  error.tsx  not-found.tsx
  api/parse/route.ts          unchanged
  (app)/
    layout.tsx                <InvoicesProvider><ManualValuesProvider><ToastProvider><AppShell>
    page.tsx                  Overview
    invoices/page.tsx         Invoices (+ drawer/compare via search params)
    analytics/page.tsx        Analytics (tabs)
    data/page.tsx             Data & settings
components/
  ui/        Button (variants: primary · secondary · ghost · destructive · destructive-quiet · link; sizes sm/md/lg),
             IconButton (required `label`), SortButton, SegmentedControl, Tabs, ToggleChip (Chip), MenuButton + Menu,
             ActionBar (priority-based overflow into "More"), Tooltip, Spinner, Checkbox, Field, Input, Select,
             TypeBadge, DeltaChip, Card, Stat, Dialog, Drawer, Banner, Skeleton, EmptyState
  dev/       (app/dev/ui/page.tsx) component gallery: every control × size × state, light + dark, 375/1440 frames,
             computed contrast table — dev only, `notFound()` in production, outside the (app) group
scripts/     ui-audit.mjs (CDP check: target size, accessible name, focus change, contrast)
  shell/     AppShell, SidebarNav, BottomNav, TopBar, ConnectionStatus, SkipLink, ThemeSwitch
  toast/     ToastProvider, ToastViewport
  upload/    UploadDialog, DropZone, UploadQueue, WindowDropTarget
  invoices/  FilterBar, PeriodPopover, ActiveFilters, InvoiceTable, InvoiceRow, InvoiceCardList,
             SelectionBar, RowMenu, InvoiceDrawer, InvoiceHeader, PartiesPayment, LineItemTable,
             ManualHeatingEditor, InvoiceEditForm, CompareDialog
  overview/  KpiRow, KpiCard, PeriodSwitcher, MonthlyCostsCard, MonthBreakdown, LatestInvoices
  analytics/ AnalyticsTabs, RangeControl, MonthlyCostsTab, UtilitiesTab, YoYTab, SmallMultiple
  charts/    ChartCard, ChartTooltip, ChartToolbar, ViewSwitch, ChartTypeSwitch, ExportMenu,
             StackedBars, SmallBars, YearLines, DataPanel, useChartColors
  overlay/   FullscreenDialog
  print/     PrintRoot, PrintPanel, PrintReport, PrintTable, PrintChart   (light-mode-only print tree, §4.12)
  data/      ManualValuesTable, ImportPanel, ExportPanel, SyncPanel, AppearancePanel, DangerZone
hooks/
  useInvoices.tsx  useManualValues.tsx  useFilters.ts  useUploader.ts  useTheme.ts
  useReducedMotion.ts  useMediaQuery.ts  useHotkeys.ts (scoped)  useToast (from toast/)
  useDataView.ts (shared Chart/Table + type + fullscreen + export state for ChartCard/DataPanel)
  useChartPrefs.ts (per-chart `localStorage` chart-type memory, §4.11.3)
lib/
  format.ts        money / number / date / delta formatters (single source)
  dates.ts         parse "DD/MM/YYYY", monthKey "Mon YYYY", compare, YYYY-MM helpers
  categories.ts    UTILITY_CATEGORIES + matchers (once), isManualRow, isParkingLine, HEATING_RATE = 76
  analytics.ts     amountsByType, monthlyTotals, utilitySeries(metric), yoySeries, kpis, monthBreakdown
  adjustments.ts   applyManualAdjustments, computeLineItemView (heating row logic)
  filters.ts       applyFilters, sortInvoices, legacy-filter migration, URL (de)serialise
  compare.ts       matchLineItems, diffTotals
  export.ts        toJson, toCsv, toExcelCsv, download   (CSV/JSON/XLS string builders, from Phase 0)
  png.ts           chart SVG → canvas → PNG blob, font-embedding for export (§4.12.1)
  pdf.ts           exportPanelToPdf, exportReportToPdf — print-pipeline orchestration (§4.12.2)
  parseWarnings.ts sanity flags for an upload result
  storage.ts parseInvoice.ts supabase.ts pdf-polyfills.ts      UNCHANGED (until optional Phase 11)
public/fonts/      Fira Sans/Code woff2 subset used only for PNG export font-embedding (§2.3, §4.12.1)
app/fonts/         Fira Sans/Code woff2 files used by next/font/local (§2.3)
tests/             vitest specs + fixtures (copy of data/invoices.json + synthetic combined-invoice + manual-value cases)
```
`components/InvoiceCard.tsx`, `components/LineItemTable.tsx`, `components/FileUpload.tsx`, `components/Toast.tsx` are replaced and deleted in the phase that supersedes them.

### 6.2 State

React context + `useReducer` (no state library).
- `InvoicesProvider`: `{ status: 'loading'|'ready'|'error', invoices, error, reload(), addMany(), update(), remove(), removeAll(), importMany(), undo(), canUndo }`. All mutation handlers call the **same `lib/storage.ts` functions in the same order** as today's `page.tsx` handlers (optimistic update → storage call → rollback on error; 10-level undo stack). **Important constraint:** today's `loadInvoices()` swallows its own error and returns `[]`, so Phase 3 can show a loading/retry state but cannot truthfully distinguish "empty" from "load failed" until optional Phase 11 changes that API to return `{ data, error }`; do not fake a load-error banner from an empty result.
- `ManualValuesProvider`: `{ values, setValue(monthKey, n), saveAll() }` (keeps `saveManualValues` semantics).
- URL = source of truth for: filters, sort, drawer `?invoice=`, compare `?compare=`, analytics `?tab=&range=`.
- `localStorage`: `invoice-parser-filters` (unchanged shape), `invoice-parser-theme` (new; reads legacy `invoice-parser-dark-mode`), `invoice-parser-ui` (sidebar collapsed, density).
- The 35 `useState`s in `page.tsx` become: provider state, `useFilters`, and local state inside the component that owns it (menus, edit form, queue).

### 6.3 Performance & Next.js notes
- Charts (`components/charts/*`) loaded with `next/dynamic` (`ssr:false`) — Recharts is the heaviest client dependency; Overview loads one chart, Analytics loads per tab.
- Layout chrome (AppShell static parts, fonts) stays server-rendered; data screens are client components because data comes from the browser Supabase client (don't change this).
- Selectors in `lib/analytics.ts` are pure and memoised by `useMemo` on `[invoices, manualValues, range]`; search input uses `useDeferredValue`.
- Fix the existing hook-deps bug (`utilityCategories` inside the component) by moving constants to `lib/categories.ts`.

### 6.4 Dependencies

| Package | Type | Why | Rejected alternatives |
|---|---|---|---|
| `lucide-react` | runtime | Replaces 33+ pasted SVGs with one consistent, tree-shakeable icon set (skill checklist: Heroicons/Lucide, consistent stroke) | Inline SVG (current, inconsistent); Phosphor (also fine, heavier install for no benefit here) |
| `vitest` | dev | Locks existing numbers before refactor (Phase 0) and keeps analytics/format/filter logic honest; ~zero runtime cost | `node --test` + tsx (needs tsx anyway); no tests (too risky for a money app) |
| *(none)* | — | **Fonts** via built-in `next/font/local` (locally vendored Fira Sans/Code woff2, §2.3); **dialogs/drawer/popovers/full-screen** via native `<dialog>` (+ optional Fullscreen API, §4.11.5); **toasts** custom (≈80 lines); **tabs/segmented/chart-type/view switches** custom (ARIA radiogroup/tab patterns); **dates** via `Intl`; **animation** via CSS; **PNG export** via SVG→canvas (`lib/png.ts`); **CSV export** via string building (`lib/export.ts`, from Phase 0); **PDF export** via the browser's own print pipeline (`window.print()`, `lib/pdf.ts`, §4.12) | Radix/shadcn (≈6 extra packages for 4 primitives), sonner, date-fns, framer-motion; **`jsPDF`+`html2canvas`** (~260 KB, bitmap chart quality loss, diacritic risk — rejected, §4.12.1); **`@react-pdf/renderer`** (~450 KB, duplicate chart components needed — rejected, kept as a documented fallback if print-dialog UX proves unacceptable) |

Round 2 adds **zero new runtime or dev dependencies** — the entire shared-toolbar/fullscreen/export feature set (F49–F55) is built from already-planned primitives (`<dialog>`, CSS, `Intl`, SVG/canvas, `window.print()`) plus `lucide-react` icons already included in Phase 1.

Keep `recharts@^3.6` (already installed). Don't touch unrelated packages (`pdfjs-dist`, `unpdf`, `autoprefixer`).

---
## 7. Phased implementation plan

Approach: **strangler**. The old single page keeps working (it moves to `/invoices` in Phase 2 and is dismantled piece by piece). Every phase ends with a working, deployable app; no phase leaves a feature without a home. Order is chosen so a feature is never removed before its replacement ships (e.g. Analytics before the old chart toggles go; Data page before the old toolbar's Import / Clear / Save go).

**Definition of done for every phase** (not repeated below):
`npx tsc --noEmit` clean · `npm run build` passes · `npm test` passes · touched F-IDs from §1.2 re-checked by hand against the old behaviour · screenshots at 375 / 768 / 1024 / 1440 px in light and dark (via the `cdp-browser-automation` skill; **375 and 1440 in both themes are mandatory for every changed screen and state, filed under `project_notes/ui-revamp-shots/phase-N/` and checked against the §2.7.11 controls checklist, including `scripts/ui-audit.mjs` and the "no raw `<button>`/colour utility classes in migrated files" grep**) · keyboard-only pass on the changed screen · OS reduced-motion check · **`lib/storage.ts`, `lib/parseInvoice.ts`, `lib/supabase.ts`, `app/api/parse/route.ts` have an empty git diff** (except Phase 11). **From Phase 3.5 onward**, any phase that ships or reuses a `ChartCard`/`DataPanel` additionally checks: Chart|Table and Bar|Line|Area switches present and keyboard-operable; chart-type memory survives a reload; Expand opens a real full screen (dialog, and native fullscreen where supported) and Esc closes it cleanly; CSV/PNG/PDF export produce a correct file/print preview, **with the PDF/print preview specifically checked for the Polish invoice line items in the fixture data (e.g. "Central Heating", "Cold Water" sourced from `ciepła`/`zimnej wody`) rendering their diacritics correctly** (ł ą ś ć ę ż ź ń ó).

Sizes: **S** ≈ ≤ 3 h, **M** ≈ half–1 day, **L** ≈ 1–2 days of focused work.

### Phase 0 — Safety net + pure-logic extraction (no visual change) · M
**Goal:** make the redesign provably number-safe.
**Files:** new `lib/dates.ts`, `lib/categories.ts`, `lib/analytics.ts` (`amountsByType`, `monthlyTotals`, `utilitySeries(metric)`, `yoySeries`), `lib/adjustments.ts` (`applyManualAdjustments`, `HEATING_RATE`), `lib/export.ts` (JSON/CSV/Excel string builders); `tests/legacy-reference.ts` (verbatim copy of today's inline logic, frozen), `tests/*.test.ts`, `tests/fixtures/*` (copy of `data/invoices.json` + synthetic combined Nov-2026 invoice + manual-value cases), `vitest.config.ts`, `package.json` (+`vitest`, `"test"` script). `app/page.tsx`: only swap inline function bodies for imports.
**Steps:** (1) copy legacy logic to `tests/legacy-reference.ts` *before* editing `page.tsx`; (2) write new lib functions; (3) tests assert new === legacy on fixtures; (4) swap `page.tsx` to the lib.
**Acceptance:**
- Tests prove identical output for: monthly totals by type, rent/utility/parking series, all 15 utility series (gross/qty/unit price × 5), YoY map, `applyManualAdjustments` (incl. floor-at-0 and "already has manual row"), CSV and Excel strings, JSON export string.
- Combined-invoice fixture: parking line split out of Rent, totals sum back to invoice gross.
- App looks and behaves identically; `page.tsx` shrinks by ~450 lines.

### Phase 1 — Foundations: tokens, fonts, theme, formatting, primitives, toasts · M
**Goal:** the new visual language exists and is usable; old page picks up fonts, theme and toasts.
**Files:** `app/layout.tsx` (fonts, theme init script, `suppressHydrationWarning`), `app/globals.css` (tokens from §2.2, focus ring, reduced-motion; keep print rules for now), `lib/format.ts` (+tests), `hooks/useTheme.ts`, `hooks/useReducedMotion.ts`, `components/ui/*` (Button, IconButton, SortButton, SegmentedControl, Tabs, ToggleChip, MenuButton/Menu, ActionBar, Tooltip, Spinner, Checkbox, Field, Input, Select, TypeBadge, DeltaChip, Card, Banner, Skeleton, Dialog — all per §2.7), button-state tokens from §2.7.2 in `app/globals.css`, `app/dev/ui/page.tsx` (gallery), `scripts/ui-audit.mjs`, `components/toast/*`, `package.json` (+`lucide-react`). `app/page.tsx`: replace `Toast` usage and the dark-mode state with the new provider/hook only.
**Acceptance:**
- `fmtMoney(1234.5)` → `1 234,50 zł` (NBSP before zł), `fmtMoney(-80)` → `−80,00 zł`, delta formatter signs correct (unit tests).
- Fira Sans `tnum` digits equal width in a test table (else fall back per §2.3); Polish glyphs `ł ż ś ć ą ę ó ń` render in Fira Sans.
- Hard reload in dark mode shows **no light flash**; System / Light / Dark works; legacy `invoice-parser-dark-mode` migrated.
- Toasts: ≥ 4.5:1, `aria-live`, errors persist, pause on hover/focus, Undo action supported.
- Every primitive shows the focus ring in both themes; all lucide icon names used in §2.5 verified to exist.
- Composed-colour contrast script passes for the §2.2 pairs.
- **Buttons & controls (§2.7):** `Button` renders all 6 variants × sm/md/lg × default / hover / active / focus-visible / disabled-with-reason / loading in light and dark; heights are 32 / 40 / 48 px (36 / 44 / 48 on touch) with a ≥ 44 px hit area on touch; the loading state does not change the button width (measured in the gallery); a disabled button cannot be created without `disabledReason`, and `IconButton` cannot be created without `label` (type tests); `MenuButton`, `SegmentedControl`, `Tabs`, `ToggleChip`, `Checkbox`, `Input`, `Select` and `Tooltip` pass keyboard checks (arrows / Home / End / Esc / focus return) and show the focus ring in both themes; no outside-click overlay div is used.
- **`/dev/ui` gallery** exists, is a 404 in production builds, shows every control in light and dark panels with 375 and 1440 px frames, and its computed contrast table has **zero failures** (text ≥ 4.5:1; borders, icons and focus ring ≥ 3:1). `scripts/ui-audit.mjs` runs against it with zero findings.
- **Phase 1 exit gate:** screenshots of `/dev/ui` (light and dark × 375 and 1440 px) and the contrast table are given to you; **Phase 2 does not start until you have reviewed them.**

### Phase 2 — App shell & routes · S–M
**Gate:** starts only after the Phase 1 `/dev/ui` gallery review (§2.7.11). Shell buttons (Upload PDFs, theme, More, nav items) use the Phase 1 components only.
**Goal:** navigation exists; nothing else changes.
**Files:** new `app/(app)/layout.tsx`, `components/shell/*`; **move** `app/page.tsx` → `app/(app)/invoices/page.tsx` unchanged (own state still); `app/(app)/page.tsx` temporarily `redirect('/invoices')`; nav renders only routes listed in an `ENABLED_ROUTES` constant (grows as phases ship).
**Acceptance:** all current functionality works at `/invoices`; `/` redirects; sidebar (≥1280) / rail (768–1279) / bottom bar (<768); skip link first in tab order; `aria-current`; collapse state remembered; print CSS still hides the sidebar.

### Phase 3 — Data layer providers · L
**Goal:** state out of the page; load failures visible.
**Files:** `hooks/useInvoices.tsx`, `hooks/useManualValues.tsx`, `lib/filters.ts` (+ legacy-filter migration), providers mounted in `app/(app)/layout.tsx`; old `invoices/page.tsx` consumes providers and drops its handlers (upload save, delete, undo, edit, clear, import, manual values).
**Acceptance:**
- Handlers call the same `storage.ts` functions in the same order (verified with a mocked storage in tests: delete → `deleteInvoice`; undo → `saveInvoices(previous)`; edit → `addInvoice(…, id)`; clear → `clearAllInvoices`; import → `addInvoice` each).
- Filter tests: type/month/range/search combinations equal the legacy `filteredInvoices` on the fixture; legacy `filterMonth` converts to From = To.
- Initial load shows skeleton/"Loading…". With the frozen current `loadInvoices()` API, a completed `[]` shows the honest empty state; visible load-failure Banner + Retry is explicitly deferred to optional Phase 11's `{ data, error }` result API rather than guessed.
- Parity checklist F3–F6, F13–F16, F38, F48 passes by hand; `invoices/page.tsx` < 1,300 lines.

### Phase 3.5 — Shared data-view toolbar, full screen, export (NEW, round 2) · L
**Goal:** build the Chart|Table / Bar|Line|Area / Expand / Export machinery **once**, before any Analytics chart exists, so every chart and table built from Phase 4 onward is a `ChartCard`/`DataPanel` from day one instead of being retrofitted later.
**Files:** `hooks/useDataView.ts`, `hooks/useChartPrefs.ts`, `components/charts/{ChartToolbar,ViewSwitch,ChartTypeSwitch,ExportMenu,DataPanel,ChartCard}.tsx`, `components/overlay/FullscreenDialog.tsx`, `components/print/{PrintRoot,PrintPanel,PrintTable,PrintChart}.tsx`, `lib/png.ts` (+tests), `lib/pdf.ts` (+tests for the pure parts: filename/slug generation, `@page` size decision, footer string), `app/globals.css` (scoped `@media print` rules for `#print-root`, replacing the old global print block from `globals.css:42-105`). No real chart exists yet, so this phase is built and tested against **one throwaway demo panel** (a tiny bar chart of the Phase 0 fixture's monthly totals) that is deleted once Phase 4 ships the real thing.
**Steps:** (1) `useDataView` state machine (`view: 'chart'|'table'`, `chartType`, `isFullscreen`) and its `localStorage` persistence via `useChartPrefs`; (2) `ChartToolbar` composing `ViewSwitch` + `ChartTypeSwitch` + Expand + `ExportMenu` buttons, all text-labelled; (3) `FullscreenDialog` wrapping `<dialog>` + best-effort `requestFullscreen()`; (4) `lib/png.ts` (SVG → canvas → blob, with the `public/fonts/` Fira Sans subset embedded); (5) `lib/pdf.ts` + `components/print/*` (the light-mode-only print tree and `window.print()` orchestration, §4.12.2); (6) wire all four into the demo panel; (7) delete the demo panel at the end of Phase 4a once a real `ChartCard` exists to take over the acceptance checks below.
**Acceptance:**
- On the demo panel: Chart/Table switches correctly; Bar/Line/Area switches correctly and Line/Area are disabled with a visible, `aria-describedby`'d reason when the fixture is truncated to < 4 points; the chosen type survives a hard reload (`localStorage['invoice-parser-chart-prefs']`).
- Expand opens a `<dialog>` (verified even with the Fullscreen API stubbed out/unavailable, e.g. headless Safari emulation), traps focus, Esc closes it and returns focus to the Expand button; chart + table appear side by side ≥ 1024 px and stacked below that; landscape phone emulation (375×667 rotated) renders a usable layout without attempting `screen.orientation.lock`.
- Export → CSV downloads a correct, BOM-prefixed file for the demo data; Export → PNG downloads a crisp (2×) raster with the Fira Sans glyphs embedded (visually confirmed, incl. one Polish-character label injected into the demo data); Export → PDF opens the print dialog with only the demo panel's `#print-root` visible (`body > :not(#print-root)` are hidden), title/range/footer present, and a forced-in Polish-character row (e.g. "Centralne ogrzewanie") renders its diacritics in the print preview.
- `lib/pdf.ts`/`lib/png.ts` pure helpers (filename slugging, `@page` size decision for `wide` panels, footer timestamp string) have unit tests.
- Nothing here touches `lib/storage.ts`/`parseInvoice.ts` (empty diff, per the phase-wide definition of done).

### Phase 4 — Chart infrastructure + Analytics · L (3 sub-tasks, each shippable)
**Shared (4a):** `components/charts/{StackedBars,SmallBars,YearLines,ChartTooltip,useChartColors}.tsx` (the toolbar/`ChartCard`/`DataPanel` shells already exist from Phase 3.5 — this phase only adds the Recharts render bodies that plug into them), `components/analytics/{AnalyticsTabs,RangeControl}.tsx`, `app/(app)/analytics/page.tsx`, enable nav item.
- **4a Monthly costs tab (M):** Stacked + Separate-scales views, table, range control, delete the Phase 3.5 demo panel once this tab's `ChartCard` is live. *Then remove the old "Cumulative" toggle and its 3 chart blocks from the old page.* **Accept:** series equal the legacy rent/utility/parking arrays (golden test); parking visible in Separate scales; Chart/Table toggle; Bar/Line/Area switch works on real monthly data (Line enabled once ≥ 4 months exist in the fixture); tooltip keyboard focus; reduced-motion disables animation; empty range message; loads via `next/dynamic`; Expand and Export (CSV/PNG/PDF) all work against the real series, including a PDF preview check with a real Polish-sourced category label ("Centralne ogrzewanie"/"Zimna woda").
- **4b Utilities tab (M):** metric segmented, 5 small multiples, Expand view, All-utilities stacked (Cost), Waste hidden for Usage/Unit price with note. *Remove old "Gross / Qty / Unit Price" toggles and 15 chart blocks.* **Accept:** all 15 metric×sub-type series equal legacy (golden); manual heating rows excluded; units come from line items; months with no invoice render as gaps; each of the 5 mini-charts and the "All utilities" chart exposes Chart|Table, Bar|Line|Area (Area only on "All utilities"), Expand, Export per §4.11.6's mapping table.
- **4c Year over year tab (S–M):** type select (Utility default), lines per year, table with Δ, empty state for < 2 years. *Remove old "YoY" toggle and block.* **Accept:** Utility series equals legacy `yearOverYearData`; Rent/Parking/Total use `amountsByType`; <4-month years shown as dots; chart defaults to Line with Bar(Grouped) as the switch option (not disabled, since the <4-point rule only blocks Line/Area, and here it's handled per-year via the dots fallback instead).
**After 4c:** the old filter bar's chart toggles are all gone; every chart on `/analytics` is a `ChartCard` with the full §4.11 toolbar; the Analytics page gets its "Report (PDF)" action (F54, §4.12.4) wired against real tab content.

### Phase 5 — Overview · L
**Files:** `app/(app)/page.tsx` (replaces redirect), `components/overview/*`, `lib/analytics.ts` (+`kpis`, `monthBreakdown`), reuse `StackedBars`/`ChartCard` from Phase 3.5/4; enable nav item.
**Acceptance:** KPI totals = chart bars = table sums for the fixture (test); combined Nov-2026 invoice appears as Rent + Parking in KPI 2 and the breakdown; delta edge cases (no previous month, previous = 0, one month only, missing prior year); period switcher defaults to latest month with data; click bar sets period; Chart/Table toggle (+Bar/Line/Area, Expand, Export) replaces old "Monthly Sum"; empty/loading/error states; first-load stagger plays once and is off under reduced motion; latest-invoice rows link to `/invoices` (deep link `?invoice=` arrives in Phase 9); **"Report (PDF)" (F54) produces a one-page Overview report with KPIs + chart + table and correct Polish diacritics in "This month by item" category names.**

### Phase 6 — Data & settings page · M
**Files:** `app/(app)/data/page.tsx`, `components/data/*`, `lib/export.ts` (already from P0), `hooks/useTheme` UI hooked into AppearancePanel; enable nav item.
**Acceptance:** manual-values table is a `DataPanel` (edits persist with the same key/maths as the old editor, compare against old editor results for 3 months; Export CSV/PDF and "Show as chart" work); import preview shows new vs existing counts and does **not** create duplicate rows in state (fixes P21); exports match Phase-0 golden strings; **PDF export (JSON/CSV/Excel + new PDF option, F38–F41) produces a correct multi-page document for the full invoice list**; Reload and "Save manual values now" work; Danger zone dialog + Undo toast; theme setting works (plus the new "Reset chart/table view choices" action clears `invoice-parser-chart-prefs`); shortcuts list present (now including `Cmd/Ctrl+Shift+F` for fullscreen); old File/Export/Clear/Save toolbar still exists on `/invoices` until Phase 8.

### Phase 7 — Upload flow · L
**Files:** `components/upload/*`, `hooks/useUploader.ts`, `lib/parseWarnings.ts` (+tests), top-bar Upload button wired; remove `components/FileUpload.tsx` and the old upload/parse-error blocks from the old page.
**Acceptance:** F1–F7; test with `faktura_fa_mys_124_11_2026.pdf`, a non-PDF, a corrupt PDF, a duplicate, and a mixed batch; each file shows a text+icon status; duplicate row links to the existing invoice; warnings for empty issue date / `Unknown` number / zero total / no line items; Retry failed re-sends only failures; window-wide drop works on all routes; keyboard-only upload works; summary announced via `aria-live`. *Confirm first* that `route.ts` accepts one file per request (else use the single-request fallback in §4.6).

### Phase 8 — Invoices list & filters · L
**Files:** `components/invoices/{FilterBar,PeriodPopover,ActiveFilters,InvoiceTable,InvoiceRow,InvoiceCardList,SelectionBar,RowMenu}.tsx`, `hooks/useFilters.ts`, rewrite `app/(app)/invoices/page.tsx` to compose them, using the **`DataPanel` from Phase 3.5** for the table itself. Old toolbar, filter bar, 6 summary cards, table, inline edit row and old compare view are removed. Interim wrappers (so nothing is lost before Phase 9): selected row opens the **existing `InvoiceCard`** (with the old manual-value editor markup) inside the new `Drawer` primitive; "Edit" opens the old inline edit form extracted unchanged into a temporary dialog; Compare opens the existing comparison markup extracted unchanged into a temporary dialog.
**Acceptance:** F8–F10, F18 (table-scoped), F19–F24, F39–F42, F14/F16 (Undo toast + Cmd/Ctrl+Z only outside text fields); date range has a visible control; filters mirrored to URL and `localStorage` (shape unchanged); sorted by Issued ↓ by default; active-filter chips; result strip; mobile card list; sticky bar doesn't hide focused rows; no global ArrowUp/Down capture; empty / no-match / load-failed states; **the Invoices table exposes Expand (full screen), Export (CSV/PDF), and "Show as chart" (F55, monthly aggregation of the currently filtered rows) via its `DataPanel` wrapper**. Nothing listed in §1.2 is unreachable (check the table row by row).

### Phase 9 — Invoice drawer & compare dialog · L (2 sub-tasks)
- **9a Drawer (L):** `InvoiceDrawer`, `InvoiceHeader`, `PartiesPayment`, new `LineItemTable` wrapped in a `DataPanel`, `ManualHeatingEditor`, `InvoiceEditForm`, `lib/adjustments.ts#computeLineItemView`; `?invoice=<id>` deep link + Prev/Next; delete `components/InvoiceCard.tsx` and old `components/LineItemTable.tsx`. **Accept:** F13, F28, F28b, F29, F30; heating-row behaviour equals the legacy rules for: no manual value, manual value with heating row, stored manual row already present, heating gross < adjustment (floor at 0); edit linkage and 0.01 tolerance (unit-tested); inline errors; unsaved-changes guard; focus returns to the row; Esc/Back close; bottom sheet on phones; Overview "Latest invoices" now deep-link here; the line-items `DataPanel` exposes its consistent toolbar (visible Chart|Table with Chart disabled as non-time-series, Expand, CSV/PDF Export).
- **9b Compare (M):** `CompareDialog`, `lib/compare.ts` (+tests vs legacy numbers), comparison totals and line-items wrapped in `DataPanel`s. **Accept:** same matched rows and diffs as legacy for the fixture; "Only in A/B" chips; details expander for qty/unit price; Swap; phones stack; each table exposes the consistent toolbar (Chart disabled with the explicit non-time-series reason, Expand, CSV/PDF Export).

### Phase 10 — Polish, cleanup, hardening of the UI · M
**Files:** `app/error.tsx`, `app/not-found.tsx`, remove `tests/legacy-reference.ts` once golden outputs are snapshotted as plain JSON, delete dead code (`runningTotals`, unused storage helpers *not touched*), motion/hover pass, optional "Needs review" card on Overview (invoices with type Other, zero total, `Unknown` number, empty issue date — uses `parseWarnings`). (The print stylesheet itself was already rebuilt, scoped, and tested in Phase 3.5/4 — this phase only does a final pass, no new print work.)
**Acceptance:** full axe/devtools + VoiceOver pass on all four routes; print preview of Invoices is clean; **a final sweep confirms every chart/table in the app (§4.11.6's mapping table) actually has the toolbar — nothing was skipped during Phases 4–9**; **a final controls sweep: `rg "<button|<select|type=\"checkbox\"" app components --glob "!components/ui/**"` and the colour-utility grep (§2.7.11) return nothing, every row of the §2.7.10 table is implemented, and `scripts/ui-audit.mjs` is clean on all four routes in both themes**; Lighthouse performance ≥ 90 on `/` locally (charts lazy); bundle of `/invoices` has no Recharts; docs updated (`project_notes/`); screenshots archived.

### Phase 11 — OPTIONAL storage hardening (needs your OK; touches `lib/storage.ts`)
Not part of the redesign; listed because the audit found them:
1. `saveManualValues` deletes all rows then inserts — a failure between the two loses every manual value; use the existing (unused) `setManualValue` upsert per month instead (`storage.ts:276-301` vs `304-319`).
2. `addInvoice` always stamps `parsed_at = now`, so Undo/Edit rewrite the timestamp of every re-saved invoice (`storage.ts:122`); keep the original `parsedAt` on update.
3. Undo of one delete re-upserts **all** invoices (`saveInvoices(previousState)`) — restore only the deleted one.
4. Import should skip invoices whose `invoiceNumber+issueDate` already exist.
5. Supabase anon key is used directly from the browser with no auth; if this app is ever hosted beyond your laptop, add RLS/auth first.

---

## 8. Risks & mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Data/storage behaviour changes by accident.** Month key `"Mon YYYY"`, id format, `DD/MM/YYYY` strings, localStorage keys are load-bearing. | Storage files frozen (empty diff check each phase); Phase 0 golden tests; keep keys/shapes; new formats are display-only. |
| R2 | **Manual heating maths regress** (×76, floor at 0, row present/absent). | Single `adjustments.ts` + tests for 4 cases; compare old vs new editor on 3 real months in Phase 6/9; `HEATING_RATE` defined once. |
| R3 | **Combined rent+parking classification drifts** between KPI, charts, table. | One `amountsByType`; stored type stays `'Rent'`; "Rent + Parking" badge derived; test with the real Nov-2026 PDF (`faktura_fa_mys_124_11_2026.pdf`). |
| R4 | **Supabase sync**: providers could double-save or race (delete → undo). | Handlers keep today's order; undo stack serial; mocked-storage call-order tests (Phase 3). |
| R5 | **Fonts** via `next/font/google` need network at build time. | Fallback to `next/font/local` with downloaded Fira files; system stack as last resort. |
| R6 | **Recharts 3 SSR/hydration** and bundle size. | `next/dynamic` `ssr:false`; fixed-height skeletons; verify `accessibilityLayer` keyboard behaviour in 4a. |
| R7 | **Default sort changes** (unsorted/parsed-at → Issued ↓); old Undo re-stamps `parsed_at`. | Sorting by issue date makes the list stable regardless of `parsed_at`; called out in open question list as a decision. |
| R8 | **Deep link before data loads** (`?invoice=` on first render). | Drawer shows skeleton until `status==='ready'`, then "Invoice not found" with link to list. |
| R9 | **Intl differences** (`pl-PL` grouping, compact notation) across browsers/Node → hydration mismatch or odd ticks. | Data is client-loaded (no SSR of numbers); format tests; verify compact output in Chrome/Safari; fallback formatter for axes. |
| R10 | **Native `<dialog>` quirks** (Safari focus, scroll lock). | Small `Dialog` wrapper handles scroll lock + focus return; tested on Safari + Chrome; fallback is a portal with `aria-modal`. |
| R11 | **Big-bang rewrite** temptation. | Strangler order; each phase shippable; old page remains until Phase 8. |
| R12 | **Scope creep from new "nice" items** (Needs-review card, parties/payment, All-utilities chart, import preview). | All additive and read-only; flagged as such; can be cut without affecting parity. |
| R13 | **React 18 vs `@types/react` 19** mismatch may surface in new typed components (e.g. `ref` props). | Keep to React 18 APIs (`forwardRef`); don't upgrade as part of this work. |
| R14 | **Print/PDF pipeline is browser-dependent** (print dialog UI, default margins, "Save as PDF" naming all differ slightly across Chrome/Safari/Firefox). | Spec only what's controllable via CSS (`@page`, `break-*`); Phase 3.5 acceptance explicitly tests on the browser(s) actually used daily; §9 open question 5 already flags the print-dialog step as an accepted trade-off, with Approach C as the documented escape hatch. |
| R15 | **Font embedding for PNG export silently fails** (e.g. a CORS or load-timing issue leaves PNG text in a fallback system font, invisibly). | `lib/png.ts` awaits the explicit glyph-load promise from §2.3 before rasterizing and the Phase 3.5 acceptance criteria require a *visual* check of a Polish-character label in the exported PNG, not just a code-level "no error thrown" check. |
| R16 | **`localStorage['invoice-parser-chart-prefs']` grows unbounded** as more charts/tabs ship across Phases 4–9, or a stale key lingers after a chart is renamed/removed. | Keys are namespaced by stable `storageKey`s assigned once in §4.11.6's mapping table (not regenerated per release); the Phase 6 "Reset chart/table view choices" action provides a manual escape hatch; no automatic pruning needed for a single-user localStorage-sized object. |
| R17 | **Fullscreen + print interact badly** if a user tries to export while a chart is already expanded. | `FullscreenDialog` and the print pipeline are independent, but `ExportMenu`'s PDF/CSV/PNG actions are available identically inside and outside full screen (§4.11.5), so there is no special-cased "can't export while expanded" state to get wrong. |

---

## 9. Open questions (max 5 — each has a default so work can proceed)

1. **Number format & language.** Keep English UI labels but switch money to Polish format (`1 234,50 zł`, dates `18 Nov 2025`), or keep US style (`PLN 1,234.50`)?
   **Default:** English labels + Polish money/number format (one constant to flip back).
2. **Combined rent + parking invoice.** Show Rent and Parking **separately everywhere** (as the charts already do) with a "Rent + Parking" badge on the invoice, or keep it as a single "Rent" amount in KPIs/table?
   **Default:** split everywhere; KPI card "Rent + parking" shows the total with the split underneath.
3. **Which month does an invoice belong to?** Today it's the **issue date's** month (18 Nov → Nov). Should it follow the **sale date / billing period** instead?
   **Default:** keep issue date; show sale date in the drawer; revisit only if you see months that look off.
4. **The ×76 heating rate.** It's hard-coded (rate for the manual heating value). Should it become an editable setting on the Data page (and be stored per month), or stay a fixed constant?
   **Default:** keep 76 as a single constant (`HEATING_RATE`) shown read-only on the Data page; no storage change.
5. **"Export as Excel" is really a CSV saved as `.xls`** (Excel shows a format warning). Keep it as-is, or replace with a real `.xlsx` (adds a dependency) / drop it? **Related (round 2):** PDF export uses the browser's native print dialog ("Save as PDF") rather than a one-click file download — **Decided 2026-11-03 by user: browser "Save as PDF" is fine** — keep the zero-dependency print pipeline; no `@react-pdf/renderer`.
   **Default:** keep Excel-as-CSV relabelled "Excel-compatible (.xls)"; offer CSV as the recommended option; no new dependency. PDF via print-dialog is accepted as the v1 approach; revisit only if the print-dialog step becomes a real annoyance in daily use.

Decisions I made without asking (tell me if you disagree): default sort Issued ↓; Waste Management hidden from Usage/Unit-price charts; charts no longer react to Invoices list filters (they have their own range); collapse-table/hide-table toggles dropped; light/dark/**system** theme with System default; delete uses Undo toast instead of a confirm dialog, delete-all uses a dialog; **PDF export uses a zero-dependency print pipeline, not `jsPDF`/`html2canvas` or `@react-pdf/renderer`** (§4.12.1); **chart-type choice (Bar/Line/Area) is remembered per chart in `localStorage`, not reset per session**; **full screen uses a `<dialog>` as the reliable baseline with the Fullscreen API only as a bonus**, not the other way round.

---

## Appendix A — Rebuild prompt (to recreate this plan's output)

> Redesign the Next.js 14 + Tailwind 4 invoice-parser dashboard (Polish landlord invoices, PLN) with the `ui-ux-pro-max` skill. Style: Data-Dense Dashboard "Calm Ledger" — neutral chrome, colour reserved for data (Rent `#1D5FA8`, Parking `#A63D78`, Utility `#0A7456`, Other `#5F6B7A`; dark variants lifted), Fira Sans + Fira Code, tokens via Tailwind `@theme inline` + CSS variables, light/dark/system. IA: app shell with Overview / Invoices / Analytics (Monthly costs · Utilities · Year over year) / Data & settings; invoice detail as a right drawer (bottom sheet on phones); global upload dialog with per-file queue, duplicate and parse-warning states; consolidate ~19 charts into Overview stacked chart, Analytics small multiples, YoY lines, each with a table fallback. Preserve all behaviours in §1.3 (month key `"Mon YYYY"`, ×76 manual heating maths, combined rent+parking split, duplicate key, edit linkage). Do not change `lib/storage.ts`/`parseInvoice.ts`/schema. Deliver in the 12 phases of §7, strangler-style, with vitest golden tests first.

## Appendix B — Dependencies on existing files for rebuild
`app/page.tsx` (all current behaviour, line refs in §1), `components/{InvoiceCard,LineItemTable,FileUpload,Toast}.tsx`, `lib/storage.ts` (`StoredInvoice`, `loadInvoices`, `addInvoice`, `deleteInvoice`, `clearAllInvoices`, `saveInvoices`, `loadManualValues`, `saveManualValues`, `exportToJson`, `importFromJson`), `lib/parseInvoice.ts` (`ParsedInvoice`, `LineItem`, `InvoiceType`), `data/invoices.json` (test fixture), `faktura_fa_mys_124_11_2026.pdf` (combined-invoice sample).
