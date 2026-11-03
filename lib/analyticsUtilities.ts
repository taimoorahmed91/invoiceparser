/**
 * Data for Analytics → Utilities (plan §4.7 tab 2). Pure.
 * Values come from lib/analytics `utilitySeries` (the legacy maths: category keywords, manual heating rows excluded,
 * unit price = average of gross ÷ quantity per line). On top of that: range, gaps for months without that utility,
 * the unit taken from the line items, and the latest-value / min-avg-max helpers for the cards.
 */
import { utilitySeries, monthlyTotals, type UtilityMetric } from './analytics';
import { UTILITY_CATEGORIES, matchesUtilityCategory, isManualRow } from './categories';
import { getMonthYearFromDate } from './dates';
import { fmtDeltaWith, fmtMoney, fmtNumber, fmtQuantity, type Delta } from './format';
import { monthKeyToYm, monthsWithData, resolveRange, ymRange, ymToMonthKey, type RangeSpec, type YearMonth } from './analyticsMonthly';
import type { DataRow } from './dataView';
import type { StoredInvoice } from './storage';

export type UtilityKey = 'Cold Water' | 'Hot Water' | 'Electricity' | 'Central Heating' | 'Waste Management';
export type UtilityMetricKey = 'cost' | 'usage' | 'price';

export const UTILITY_KEYS: UtilityKey[] = UTILITY_CATEGORIES.map((c) => c.key as UtilityKey);

export const UTILITY_META: Record<UtilityKey, { slug: string; color: string; polish: string }> = {
  'Cold Water': { slug: 'cold-water', color: 'var(--cold-water)', polish: 'Zimna woda' },
  'Hot Water': { slug: 'hot-water', color: 'var(--hot-water)', polish: 'Ciepła woda' },
  Electricity: { slug: 'electricity', color: 'var(--electricity)', polish: 'Energia elektryczna' },
  'Central Heating': { slug: 'central-heating', color: 'var(--central-heating)', polish: 'Ciepło' },
  'Waste Management': { slug: 'waste', color: 'var(--waste)', polish: 'Gospodarka odpadami' },
};

export const METRIC_OF: Record<UtilityMetricKey, UtilityMetric> = { cost: 'gross', usage: 'quantity', price: 'unitPrice' };

export function parseMetric(param: string | null | undefined): UtilityMetricKey {
  return param === 'usage' || param === 'price' ? param : 'cost';
}

/** Waste Management is a flat monthly fee (quantity 1, unit "UNIT"): usage and unit price say nothing, so they are hidden. */
export function isMetricAvailable(key: UtilityKey, metric: UtilityMetricKey): boolean {
  return !(key === 'Waste Management' && metric !== 'cost');
}

/** Line-item unit as written by the parser → what we show. UNIT (no real unit) → "". */
export function displayUnit(raw: string | null | undefined): string {
  const u = (raw ?? '').trim().toUpperCase();
  if (u === 'M3') return 'm³';
  if (u === 'KWH') return 'kWh';
  if (u === 'GJ') return 'GJ';
  if (u === '' || u === 'UNIT') return '';
  return u.toLowerCase();
}

function utilityLines(invoices: StoredInvoice[], key: UtilityKey) {
  const out: Array<{ inv: StoredInvoice; item: StoredInvoice['invoice']['lineItems'][number] }> = [];
  invoices.forEach((inv) => {
    inv.invoice.lineItems.forEach((item) => {
      if (matchesUtilityCategory(item.description, key) && !isManualRow(item.description)) out.push({ inv, item });
    });
  });
  return out;
}

/** The unit each category is billed in: the most common real unit on its line items ("" when there is none). */
export function categoryUnits(invoices: StoredInvoice[]): Record<UtilityKey, string> {
  const out = {} as Record<UtilityKey, string>;
  for (const key of UTILITY_KEYS) {
    const counts = new Map<string, number>();
    utilityLines(invoices, key).forEach(({ item }) => {
      const u = displayUnit(item.unit);
      if (u && (item.quantity ?? 0) > 0) counts.set(u, (counts.get(u) ?? 0) + 1);
    });
    out[key] = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  }
  return out;
}

/** "Cold Water|Nov 2026" for every month where that category has at least one (non-manual) line. */
export function categoryPresence(invoices: StoredInvoice[]): Set<string> {
  const set = new Set<string>();
  UTILITY_KEYS.forEach((key) => utilityLines(invoices, key).forEach(({ inv }) => set.add(`${key}|${getMonthYearFromDate(inv.invoice.issueDate)}`)));
  return set;
}

export interface UtilityRow extends DataRow {
  month: string;
  /** 1 when no utility data at all exists that month. */
  __empty: 0 | 1;
}

export interface UtilityResult {
  rows: UtilityRow[];
  from: YearMonth | null;
  to: YearMonth | null;
  units: Record<UtilityKey, string>;
}

/**
 * One row per month: a value per sub-type (null = that utility has no line that month).
 * `legacyZeros: true` (golden test) returns the exact legacy arrays: no gap rows, zeros instead of nulls.
 */
export function buildUtilityRows(invoices: StoredInvoice[], range: RangeSpec, metric: UtilityMetricKey, opts: { legacyZeros?: boolean } = {}): UtilityResult {
  const units = categoryUnits(invoices);
  const dataMonths = monthsWithData(invoices);
  const span = resolveRange(range, dataMonths);
  if (!span) return { rows: [], from: null, to: null, units };

  let months: string[];
  if (opts.legacyZeros) {
    months = monthlyTotals(invoices).map((r) => r.month).filter((k) => {
      const ym = monthKeyToYm(k);
      return ym !== null && ym >= span.from && ym <= span.to;
    });
  } else {
    months = ymRange(span.from, span.to).map(ymToMonthKey);
  }

  const series = utilitySeries(invoices, months, METRIC_OF[metric]);
  const present = opts.legacyZeros ? null : categoryPresence(invoices);
  const rows: UtilityRow[] = months.map((month, i) => {
    const row: UtilityRow = { month, __empty: 0 };
    let any = false;
    UTILITY_KEYS.forEach((key, c) => {
      const has = present ? present.has(`${key}|${month}`) : true;
      row[key] = has ? series[c][i].value : null;
      if (has) any = true;
    });
    if (!any) row.__empty = 1;
    return row;
  });
  return { rows, from: span.from, to: span.to, units };
}

/* ---------- formatting by metric ---------- */

export function metricFormatter(metric: UtilityMetricKey, unit: string): (n: number) => string {
  if (metric === 'cost') return (n) => fmtMoney(n);
  if (metric === 'usage') return (n) => fmtQuantity(n, unit);
  return (n) => `${fmtMoney(n)}${unit ? ` / ${unit}` : ''}`;
}

export function metricYTick(metric: UtilityMetricKey): ((n: number) => string) | undefined {
  if (metric === 'cost') return undefined; // compact PLN default
  if (metric === 'usage') return (n) => fmtNumber(n, 1);
  return (n) => fmtNumber(n, 2);
}

/** Caption under a card title: what the numbers are. */
export function metricCaption(metric: UtilityMetricKey, unit: string): string {
  if (metric === 'cost') return 'Gross cost, zł';
  if (metric === 'usage') return unit ? `Quantity billed, ${unit}` : 'Quantity billed';
  return unit ? `Average gross price per ${unit}, zł` : 'Average gross price per unit, zł';
}

/* ---------- latest value and statistics ---------- */

export interface Latest {
  value: number;
  month: string;
  previous: number | null;
  previousMonth: string | null;
}

/** Last month with a value, and the month with a value before it. */
export function latestValue(rows: Array<Record<string, unknown> & { month: string }>, key: string): Latest | null {
  const pts = rows.filter((r) => typeof r[key] === 'number').map((r) => ({ month: r.month, v: r[key] as number }));
  if (pts.length === 0) return null;
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  return { value: last.v, month: last.month, previous: prev ? prev.v : null, previousMonth: prev ? prev.month : null };
}

export function latestDelta(latest: Latest | null, fmt: (n: number) => string): Delta | null {
  if (!latest || latest.previous === null) return null;
  return fmtDeltaWith(latest.value, latest.previous, fmt);
}

export interface Stats {
  count: number;
  min: { value: number; month: string };
  max: { value: number; month: string };
  avg: number;
}

/** Min / average / max over months that have a value (gaps are not zeros). */
export function seriesStats(rows: Array<Record<string, unknown> & { month: string }>, key: string): Stats | null {
  const pts = rows.filter((r) => typeof r[key] === 'number').map((r) => ({ month: r.month, v: r[key] as number }));
  if (pts.length === 0) return null;
  let min = pts[0];
  let max = pts[0];
  let sum = 0;
  for (const p of pts) {
    sum += p.v;
    if (p.v < min.v) min = p;
    if (p.v > max.v) max = p;
  }
  return { count: pts.length, min: { value: min.v, month: min.month }, max: { value: max.v, month: max.month }, avg: sum / pts.length };
}
