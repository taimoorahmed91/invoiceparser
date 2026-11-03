/**
 * Data for Analytics → Monthly costs (plan §4.7 tab 1). Pure.
 * Series come straight from lib/analytics `monthlyTotals` (which uses `amountsByType`, so the combined
 * rent+parking invoice is already split), so the numbers equal the old Rent / Parking / Utility charts.
 * What is new here: the selectable range and honest gaps for months that have no invoice.
 */
import { monthlyTotals } from './analytics';
import { monthNames } from './dates';
import type { StoredInvoice } from './storage';
import type { DataRow } from './dataView';

/** "2025-06" */
export type YearMonth = string;

export type RangeSpec =
  | { kind: 'all' }
  | { kind: 'last'; months: 6 | 12 }
  | { kind: 'custom'; from: YearMonth; to: YearMonth };

export const DEFAULT_RANGE: RangeSpec = { kind: 'last', months: 12 };

const MONTH_KEY = /^([A-Z][a-z]{2}) (\d{4})$/;
const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "Nov 2026" → "2026-11"; null for "Unknown" and other junk. */
export function monthKeyToYm(key: string): YearMonth | null {
  const m = MONTH_KEY.exec(key);
  if (!m) return null;
  const idx = monthNames.indexOf(m[1]);
  return idx < 0 ? null : `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

/** "2026-11" → "Nov 2026" (the key used in storage and on screen). */
export function ymToMonthKey(ym: YearMonth): string {
  const m = YM.exec(ym);
  if (!m) return ym;
  return `${monthNames[Number(m[2]) - 1]} ${m[1]}`;
}

export function ymAdd(ym: YearMonth, delta: number): YearMonth {
  const m = YM.exec(ym);
  if (!m) return ym;
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Inclusive list of months from..to. */
export function ymRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const out: YearMonth[] = [];
  if (!YM.test(from) || !YM.test(to) || from > to) return out;
  for (let ym = from; ym <= to && out.length < 1200; ym = ymAdd(ym, 1)) out.push(ym);
  return out;
}

/** Range as stored in the URL: "6m", "12m", "all" or "2025-01_2025-06". Anything else → the default. */
export function parseRange(param: string | null | undefined): RangeSpec {
  if (param === 'all') return { kind: 'all' };
  if (param === '6m') return { kind: 'last', months: 6 };
  if (param === '12m') return DEFAULT_RANGE;
  const m = /^(\d{4}-\d{2})_(\d{4}-\d{2})$/.exec(param ?? '');
  if (m && YM.test(m[1]) && YM.test(m[2])) {
    return m[1] <= m[2] ? { kind: 'custom', from: m[1], to: m[2] } : { kind: 'custom', from: m[2], to: m[1] };
  }
  return DEFAULT_RANGE;
}

export function serializeRange(r: RangeSpec): string {
  if (r.kind === 'all') return 'all';
  if (r.kind === 'last') return `${r.months}m`;
  return `${r.from}_${r.to}`;
}

/** Months (as "Mon YYYY") that have at least one invoice, oldest first. */
export function monthsWithData(invoices: StoredInvoice[]): string[] {
  return monthlyTotals(invoices).map((r) => r.month).filter((k) => monthKeyToYm(k) !== null);
}

/**
 * The concrete from/to for a range. "Last N months" ends at the latest month that has data (not today),
 * and never starts before the first month with data. null when there is no data at all.
 */
export function resolveRange(range: RangeSpec, dataMonths: string[]): { from: YearMonth; to: YearMonth } | null {
  const yms = dataMonths.map(monthKeyToYm).filter((x): x is YearMonth => x !== null).sort();
  if (yms.length === 0) return null;
  const first = yms[0];
  const last = yms[yms.length - 1];
  if (range.kind === 'all') return { from: first, to: last };
  if (range.kind === 'last') {
    const from = ymAdd(last, -(range.months - 1));
    return { from: from < first ? first : from, to: last };
  }
  return { from: range.from, to: range.to };
}

export interface MonthlyRow extends DataRow {
  month: string;
  Rent: number | null;
  Parking: number | null;
  Utility: number | null;
  /** 1 for a month inside the range that has no invoice (shown as a gap, not as 0). */
  __empty: 0 | 1;
}

export interface MonthlyResult {
  rows: MonthlyRow[];
  from: YearMonth | null;
  to: YearMonth | null;
  /** Months that have data anywhere (for the Custom range selects). */
  dataMonths: string[];
}

/**
 * Rows for the chart and table. `fillGaps` (default) adds a null row for every calendar month inside the range that has
 * no invoice; with `fillGaps: false` you get exactly the legacy months (used by the golden test).
 */
export function buildMonthlyRows(invoices: StoredInvoice[], range: RangeSpec, opts: { fillGaps?: boolean } = {}): MonthlyResult {
  const { fillGaps = true } = opts;
  const totals = monthlyTotals(invoices).filter((r) => monthKeyToYm(r.month) !== null);
  const dataMonths = totals.map((r) => r.month);
  const span = resolveRange(range, dataMonths);
  if (!span) return { rows: [], from: null, to: null, dataMonths };

  const byYm = new Map(totals.map((r) => [monthKeyToYm(r.month) as YearMonth, r]));
  const rows: MonthlyRow[] = [];
  if (fillGaps) {
    for (const ym of ymRange(span.from, span.to)) {
      const r = byYm.get(ym);
      rows.push(r ? { month: r.month, Rent: r.Rent, Parking: r.Parking, Utility: r.Utility, __empty: 0 } : { month: ymToMonthKey(ym), Rent: null, Parking: null, Utility: null, __empty: 1 });
    }
  } else {
    for (const r of totals) {
      const ym = monthKeyToYm(r.month) as YearMonth;
      if (ym >= span.from && ym <= span.to) rows.push({ month: r.month, Rent: r.Rent, Parking: r.Parking, Utility: r.Utility, __empty: 0 });
    }
  }
  return { rows, from: span.from, to: span.to, dataMonths };
}

export function rangeLabel(from: YearMonth | null, to: YearMonth | null): string {
  if (!from || !to) return 'No data';
  return from === to ? ymToMonthKey(from) : `${ymToMonthKey(from)} – ${ymToMonthKey(to)}`;
}
