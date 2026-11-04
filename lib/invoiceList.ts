/**
 * Everything the Invoices list needs that is not drawing (plan §4.3). Pure.
 *  - reading the filters: the URL wins, otherwise the saved ones (same localStorage key and shape as always), a legacy month becomes From = To
 *  - writing them back as a query string (so a filtered view can be bookmarked)
 *  - the Period presets, type counts, the sort (default Issued ↓), selection for Compare, the table behind the export
 */
import { amountsByType } from './analytics';
import { applyFilters, migrateLegacyFilters, type Filters } from './filters';
import { monthKeyToYm, ymAdd, ymToMonthKey, type YearMonth } from './analyticsMonthly';
import { parseDate } from './dates';
import type { DataRow, TableSpec } from './dataView';
import { fmtDate, fmtMoney } from './format';
import type { InvoiceType } from './parseInvoice';
import type { StoredInvoice } from './storage';

/** Same key and shape as before: { filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd }. */
export const FILTERS_KEY = 'invoice-parser-filters';

export const DEFAULT_FILTERS: Filters = { filterType: 'all', filterMonth: 'all', searchQuery: '', dateRangeStart: '', dateRangeEnd: '' };

export const INVOICE_TYPES: readonly InvoiceType[] = ['Rent', 'Parking', 'Utility', 'Other'];

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const asYm = (v: unknown): string => (typeof v === 'string' && YM.test(v.trim()) ? v.trim() : '');
const asType = (v: unknown): InvoiceType | 'all' => (INVOICE_TYPES as readonly unknown[]).includes(v) ? (v as InvoiceType) : 'all';

/**
 * An old saved month ("Nov 2026") becomes From = To = that month, and the month filter is switched off, so nothing is hidden behind the
 * Period control. A month that is not a real month ("Unknown": invoices with no readable date) stays as it was and shows as its own chip.
 * A start after the end is swapped.
 */
export function normalizeFilters(f: Filters): Filters {
  let out = migrateLegacyFilters(f);
  if (out !== f && monthKeyToYm(f.filterMonth)) out = { ...out, filterMonth: 'all' };
  if (out.dateRangeStart && out.dateRangeEnd && out.dateRangeStart > out.dateRangeEnd) out = { ...out, dateRangeStart: out.dateRangeEnd, dateRangeEnd: out.dateRangeStart };
  return out;
}

function fromStored(raw: string | null | undefined): Filters {
  if (!raw) return DEFAULT_FILTERS;
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return DEFAULT_FILTERS;
    return {
      filterType: asType(o.filterType),
      filterMonth: typeof o.filterMonth === 'string' && o.filterMonth ? o.filterMonth : 'all',
      searchQuery: typeof o.searchQuery === 'string' ? o.searchQuery : '',
      dateRangeStart: asYm(o.dateRangeStart),
      dateRangeEnd: asYm(o.dateRangeEnd),
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

/** The query keys of a filtered view: ?q= &type= &from= &to= (and &month= as a shortcut for from = to). */
const URL_KEYS = ['q', 'type', 'from', 'to', 'month'];

/**
 * What the list starts with: the URL when it carries any filter (a link from Overview, a bookmark), otherwise the saved filters.
 * Read once, before the first paint of the list, so nothing is ever overwritten by defaults.
 */
export function parseListFilters(search: string, storedRaw: string | null | undefined): Filters {
  const p = new URLSearchParams(search);
  if (URL_KEYS.some((k) => p.has(k))) {
    const month = asYm(p.get('month'));
    return normalizeFilters({
      filterType: asType(p.get('type')),
      filterMonth: 'all',
      searchQuery: p.get('q') ?? '',
      dateRangeStart: asYm(p.get('from')) || month,
      dateRangeEnd: asYm(p.get('to')) || month,
    });
  }
  return normalizeFilters(fromStored(storedRaw));
}

/** `q=…&type=Utility&from=2025-01&to=2025-11`, without a leading "?". Defaults are left out. */
export function serializeListFilters(f: Filters): string {
  const p = new URLSearchParams();
  if (f.searchQuery) p.set('q', f.searchQuery);
  if (f.filterType !== 'all') p.set('type', f.filterType);
  if (f.dateRangeStart) p.set('from', f.dateRangeStart);
  if (f.dateRangeEnd) p.set('to', f.dateRangeEnd);
  return p.toString();
}

export const sameFilters = (a: Filters, b: Filters) =>
  a.filterType === b.filterType && a.filterMonth === b.filterMonth && a.searchQuery === b.searchQuery && a.dateRangeStart === b.dateRangeStart && a.dateRangeEnd === b.dateRangeEnd;

/* ---------- Period ---------- */

export type PeriodPreset = 'all' | 'year' | 'last12' | 'custom';

/** "Jan 2025 – Nov 2025", "Nov 2026", "From Jan 2025", "Until Nov 2025"; null when no period is set. */
export function periodLabel(from: string, to: string): string | null {
  if (!from && !to) return null;
  if (from && to) return from === to ? ymToMonthKey(from) : `${ymToMonthKey(from)} – ${ymToMonthKey(to)}`;
  return from ? `From ${ymToMonthKey(from)}` : `Until ${ymToMonthKey(to)}`;
}

const ymOf = (d: Date): YearMonth => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** The range a preset stands for. "Last 12 months" ends at the newest month that has an invoice (like Analytics), not at today. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, dataMonths: YearMonth[], now: Date = new Date()): { from: string; to: string } {
  if (preset === 'all') return { from: '', to: '' };
  if (preset === 'year') return { from: `${now.getFullYear()}-01`, to: `${now.getFullYear()}-12` };
  const newest = dataMonths[dataMonths.length - 1] ?? ymOf(now);
  return { from: ymAdd(newest, -11), to: newest };
}

export function detectPreset(from: string, to: string, dataMonths: YearMonth[], now: Date = new Date()): PeriodPreset {
  if (!from && !to) return 'all';
  const same = (r: { from: string; to: string }) => r.from === from && r.to === to;
  if (same(presetRange('year', dataMonths, now))) return 'year';
  if (same(presetRange('last12', dataMonths, now))) return 'last12';
  return 'custom';
}

/* ---------- chips and counts ---------- */

export interface ActiveChip {
  key: 'search' | 'type' | 'period' | 'month';
  label: string;
  /** What to change to remove this filter. */
  clear: Partial<Filters>;
}

export function activeChips(f: Filters): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (f.searchQuery) out.push({ key: 'search', label: `Search: “${f.searchQuery}”`, clear: { searchQuery: '' } });
  if (f.filterType !== 'all') out.push({ key: 'type', label: f.filterType, clear: { filterType: 'all' } });
  const period = periodLabel(f.dateRangeStart, f.dateRangeEnd);
  if (period) out.push({ key: 'period', label: period, clear: { dateRangeStart: '', dateRangeEnd: '' } });
  if (f.filterMonth !== 'all') out.push({ key: 'month', label: `Month: ${f.filterMonth}`, clear: { filterMonth: 'all' } });
  return out;
}

export type TypeCounts = Record<InvoiceType | 'all', number>;

/** How many invoices each type chip would show: counted with the search and period applied, but not the type. */
export function typeCounts(invoices: StoredInvoice[], f: Filters): TypeCounts {
  const counts: TypeCounts = { all: 0, Rent: 0, Parking: 0, Utility: 0, Other: 0 };
  for (const inv of applyFilters(invoices, { ...f, filterType: 'all' })) {
    counts.all++;
    const t = inv.invoice.invoiceType;
    counts[t in counts ? t : 'Other']++;
  }
  return counts;
}

export function describeFilters(f: Filters): string {
  const parts = activeChips(f).map((c) => (c.key === 'type' ? `Type: ${c.label}` : c.key === 'period' ? `Period: ${c.label}` : c.label));
  return parts.length ? parts.join(' · ') : 'none';
}

export function resultStats(rows: StoredInvoice[]): { count: number; total: number } {
  return { count: rows.length, total: Math.round(rows.reduce((s, r) => s + (r.invoice.totals.grossTotal || 0), 0) * 100) / 100 };
}

/* ---------- sorting ---------- */

export type SortField = 'date' | 'amount' | 'type' | 'number';
export interface ListSort {
  field: SortField;
  dir: 'asc' | 'desc';
}
export const DEFAULT_SORT: ListSort = { field: 'date', dir: 'desc' };

/** A new column starts newest / biggest first for Issued and Total, A→Z for Invoice and Type; the same column again flips. */
export function nextSort(current: ListSort, field: SortField): ListSort {
  if (current.field === field) return { field, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  return { field, dir: field === 'date' || field === 'amount' ? 'desc' : 'asc' };
}

export const ariaSortOf = (current: ListSort, field: SortField): 'ascending' | 'descending' | 'none' =>
  current.field !== field ? 'none' : current.dir === 'asc' ? 'ascending' : 'descending';

/** A new array, stable for equal values; invoices whose date can not be read go last in both directions. */
export function sortList(rows: StoredInvoice[], sort: ListSort): StoredInvoice[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, time: parseDate(row.invoice.issueDate)?.getTime() ?? null }))
    .sort((a, b) => {
      let c = 0;
      if (sort.field === 'date') {
        if (a.time === null || b.time === null) return a.time === b.time ? a.index - b.index : a.time === null ? 1 : -1;
        c = a.time - b.time;
      } else if (sort.field === 'amount') c = a.row.invoice.totals.grossTotal - b.row.invoice.totals.grossTotal;
      else if (sort.field === 'type') c = a.row.invoice.invoiceType.localeCompare(b.row.invoice.invoiceType);
      else c = a.row.invoice.invoiceNumber.localeCompare(b.row.invoice.invoiceNumber, undefined, { numeric: true });
      return c * sign || a.index - b.index;
    })
    .map((x) => x.row);
}

/* ---------- one row ---------- */

export type InvoiceKind = 'Rent' | 'Parking' | 'Utility' | 'Other';

/** ["Rent", "Parking"] for the combined invoice, otherwise the one type. */
export function invoiceKinds(inv: StoredInvoice): InvoiceKind[] {
  const type = inv.invoice.invoiceType;
  if (type === 'Rent') return amountsByType(inv.invoice).Parking > 0 ? ['Rent', 'Parking'] : ['Rent'];
  return type === 'Parking' || type === 'Utility' ? [type] : ['Other'];
}

/* ---------- selection for Compare ---------- */

export const MAX_COMPARE = 2;

/** Toggle one id in the ordered selection. A third one is refused (the selection is returned unchanged). */
export function toggleSelected(selected: readonly string[], id: string, max = MAX_COMPARE): string[] {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return selected.length >= max ? [...selected] : [...selected, id];
}

export function selectionHint(count: number): string {
  if (count === 0) return '';
  if (count === 1) return '1 selected — pick one more to compare';
  return `${count} selected`;
}

/* ---------- keyboard ---------- */

/** True while the cursor is in something you type into: Cmd/Ctrl+Z and "/" must leave those alone. */
export function isTextEntry(el: { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = (el.tagName ?? '').toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag !== 'input') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'image'].includes((el.type ?? 'text').toLowerCase());
}

/* ---------- the table behind the screen table (export / PDF) ---------- */

export function invoiceListSpec(rows: StoredInvoice[]): TableSpec {
  const money = (key: string) => (row: DataRow) => (typeof row[key] === 'number' ? fmtMoney(row[key] as number, (row.currency as string) || 'PLN') : '');
  return {
    columns: [
      { key: 'invoice', label: 'Invoice', align: 'left' },
      { key: 'filename', label: 'File', align: 'left' },
      { key: 'issued', label: 'Issued', align: 'left' },
      { key: 'type', label: 'Type', align: 'left' },
      { key: 'total', label: 'Total', align: 'right', formatRow: money('total') },
    ],
    rows: rows.map((r): DataRow => ({
      invoice: r.invoice.invoiceNumber,
      filename: r.filename,
      issued: fmtDate(r.invoice.issueDate),
      type: invoiceKinds(r).join(' + '),
      total: r.invoice.totals.grossTotal,
      currency: r.invoice.currency || 'PLN',
    })),
  };
}
