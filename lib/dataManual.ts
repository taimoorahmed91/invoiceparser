/**
 * Data → Manual heating values (plan §4.8 item 1). Pure.
 * Same key and maths as the old editor in the invoice view: the key is the month key "Nov 2026" of the invoice's issue date,
 * the value is "units", and the adjustment is units × HEATING_RATE (76), see lib/adjustments.ts. Nothing here changes how a value is stored.
 */
import { HEATING_RATE } from './adjustments';
import { getMonthYearFromDate } from './dates';
import { fmtMoney, fmtNumber } from './format';
import { monthKeyToYm } from './analyticsMonthly';
import type { DataRow, TableSpec, TimeSeriesSpec } from './dataView';
import type { StoredInvoice } from './storage';

export interface ManualRow {
  /** "Nov 2026": also the storage key of the value. */
  month: string;
  ym: string;
  /** Units, 0 when no value is set. */
  units: number;
  /** units × 76, the same number the old editor showed as "Current: N × 76 = X". */
  adjustment: number;
  /** The month has a Utility invoice (a value for a month without one has no effect). */
  hasInvoice: boolean;
}

/** units × 76. Not rounded, exactly like the old editor and applyManualAdjustments. */
export function manualAdjustment(units: number): number {
  return units * HEATING_RATE;
}

/**
 * One row for every month that has a Utility invoice, plus any month that still has a stored value although its invoice is gone.
 * Newest month first (the one you are most likely to edit).
 */
export function buildManualRows(invoices: StoredInvoice[], values: Record<string, number>): ManualRow[] {
  const months = new Set<string>();
  for (const inv of invoices) {
    if (inv.invoice.invoiceType === 'Utility') months.add(getMonthYearFromDate(inv.invoice.issueDate));
  }
  const withInvoice = new Set(months);
  for (const [month, v] of Object.entries(values)) if (v > 0) months.add(month);
  const rows: ManualRow[] = [];
  for (const month of Array.from(months)) {
    const ym = monthKeyToYm(month);
    if (!ym) continue;
    const units = values[month] > 0 ? values[month] : 0;
    rows.push({ month, ym, units, adjustment: manualAdjustment(units), hasInvoice: withInvoice.has(month) });
  }
  return rows.sort((a, b) => (a.ym < b.ym ? 1 : a.ym > b.ym ? -1 : 0));
}

export type UnitsParse = { ok: true; value: number } | { ok: false; error: string };

export const MAX_UNITS = 100000;

/**
 * Text from the Units box → number. Empty means "no value" (0). Accepts "1,43" and "1.43".
 * The old editor used parseFloat(text) || 0, which turned typos into 0 without saying so; here a typo is an inline error.
 */
export function parseUnits(text: string): UnitsParse {
  const t = text.trim();
  if (t === '') return { ok: true, value: 0 };
  if (!/^(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) {
    return { ok: false, error: /^-/.test(t) ? 'Units can’t be negative' : 'Enter a number, for example 1,43' };
  }
  const value = parseFloat(t.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, error: 'Enter a number, for example 1,43' };
  if (value > MAX_UNITS) return { ok: false, error: `That is more than ${fmtNumber(MAX_UNITS, 0)} units` };
  return { ok: true, value };
}

/** How a stored value appears in the box: 1.43 → "1,43", 0 → "". */
export function formatUnits(units: number): string {
  return units > 0 ? fmtNumber(units, 4) : '';
}

/** "Saved" when a value is stored, "Not set" otherwise; "No utility invoice" when the value belongs to a month without one. */
export function manualStatus(row: ManualRow): string {
  if (row.units > 0) return row.hasInvoice ? 'Saved' : 'Saved · no utility invoice this month';
  return 'Not set';
}

/** The table behind the panel. The Units and Status cells are inputs on screen; CSV and PDF use the text below. */
export function manualTableSpec(rows: ManualRow[]): TableSpec {
  const dash = (v: unknown, f: (n: number) => string) => (typeof v === 'number' && v > 0 ? f(v) : '—');
  return {
    columns: [
      { key: 'month', label: 'Month', align: 'left' },
      { key: 'units', label: 'Units', align: 'right', format: (v) => dash(v, (n) => fmtNumber(n, 4)) },
      { key: 'adjustment', label: `Adjustment (× ${HEATING_RATE})`, align: 'right', format: (v) => dash(v, fmtMoney) },
      { key: 'status', label: 'Status', align: 'left' },
    ],
    rows: rows.map((r): DataRow => ({ month: r.month, units: r.units, adjustment: r.adjustment, status: manualStatus(r) })),
  };
}

/** "Show as chart" (F55): units per month, oldest first. A month without a value is a gap, not a zero. */
export function manualChartSpec(rows: ManualRow[]): TimeSeriesSpec {
  const ascending = [...rows].reverse();
  return {
    xKey: 'month',
    xLabel: 'Month',
    series: [{ key: 'units', label: 'Units', color: 'var(--central-heating)' }],
    rows: ascending.map((r): DataRow => ({ month: r.month, units: r.units > 0 ? r.units : null, __empty: r.units > 0 ? 0 : 1 })),
    formatValue: (n) => fmtNumber(n, 4),
    yTick: (n) => fmtNumber(n, 1),
    emptyLabel: 'No manual value',
    unit: 'months',
    stackable: false,
    defaultChartType: 'bar-grouped',
    fallbackChartType: 'bar-grouped',
  };
}
