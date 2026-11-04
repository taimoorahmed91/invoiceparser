/**
 * Data for the Overview page (plan §4.2). Pure.
 *
 * Every amount comes from `monthlyTotals` / `amountsByType` in lib/analytics (the same functions the Analytics charts use),
 * so a KPI, a chart bar, a table total and the "this month by item" list can never disagree. The combined Nov-2026 invoice
 * (rent and parking on one invoice) is already split by `amountsByType`, so it counts as Rent + Parking everywhere.
 */
import { amountsByType, monthlyTotals } from './analytics';
import { HEATING_RATE } from './adjustments';
import { isManualRow, matchesUtilityCategory } from './categories';
import { getMonthYearFromDate, monthNames, parseDate } from './dates';
import { fmtDelta, fmtMoneyWhole } from './format';
import { monthKeyToYm, ymToMonthKey, type RangeSpec, type YearMonth } from './analyticsMonthly';
import { UTILITY_KEYS, UTILITY_META, type UtilityKey } from './analyticsUtilities';
import type { StoredInvoice } from './storage';

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ---------- months and the period ---------- */

const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Months that have at least one invoice, oldest first, as "2026-11". */
export function dataMonthsYm(invoices: StoredInvoice[]): YearMonth[] {
  return monthlyTotals(invoices)
    .map((r) => monthKeyToYm(r.month))
    .filter((x): x is YearMonth => x !== null)
    .sort();
}

/** The period from the URL if it is a real month with data; otherwise the latest month with data. null when there is no data. */
export function resolvePeriod(param: string | null | undefined, yms: YearMonth[]): YearMonth | null {
  if (yms.length === 0) return null;
  if (param && YM.test(param) && yms.includes(param)) return param;
  return yms[yms.length - 1];
}

/** Previous and next months that have data (gaps are skipped). */
export function neighbours(yms: YearMonth[], ym: YearMonth): { prev: YearMonth | null; next: YearMonth | null } {
  const i = yms.indexOf(ym);
  if (i < 0) return { prev: null, next: null };
  return { prev: yms[i - 1] ?? null, next: yms[i + 1] ?? null };
}

const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-11" → "November 2026" (the period switcher). */
export function longMonthLabel(ym: YearMonth): string {
  const m = YM.exec(ym);
  return m ? `${LONG_MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym;
}

/** "Oct" for a month in the same year as `ref`, "Dec 2025" otherwise. */
export function relativeMonthLabel(ym: YearMonth, ref: YearMonth): string {
  const [y, m] = ym.split('-');
  return y === ref.slice(0, 4) ? monthNames[Number(m) - 1] : `${monthNames[Number(m) - 1]} ${y}`;
}

/* ---------- per month figures ---------- */

export interface MonthFigures {
  ym: YearMonth;
  month: string;
  rent: number;
  parking: number;
  utility: number;
  /** rent + parking + utility: what the chart bar and the table Total show */
  total: number;
  rentParking: number;
  invoiceCount: number;
  /** At least one Rent or Parking invoice was issued this month. */
  hasRentParking: boolean;
  /** At least one Utility invoice was issued this month. */
  hasUtility: boolean;
  utilityCount: number;
}

export function monthFigures(invoices: StoredInvoice[]): Map<YearMonth, MonthFigures> {
  const out = new Map<YearMonth, MonthFigures>();
  for (const r of monthlyTotals(invoices)) {
    const ym = monthKeyToYm(r.month);
    if (!ym) continue;
    out.set(ym, {
      ym, month: r.month, rent: r.Rent, parking: r.Parking, utility: r.Utility,
      total: r.Rent + r.Parking + r.Utility, rentParking: r.Rent + r.Parking,
      invoiceCount: 0, hasRentParking: false, hasUtility: false, utilityCount: 0,
    });
  }
  for (const inv of invoices) {
    const ym = monthKeyToYm(getMonthYearFromDate(inv.invoice.issueDate));
    const f = ym ? out.get(ym) : undefined;
    if (!f) continue;
    f.invoiceCount += 1;
    const type = inv.invoice.invoiceType;
    if (type === 'Rent' || type === 'Parking') f.hasRentParking = true;
    if (type === 'Utility') {
      f.hasUtility = true;
      f.utilityCount += 1;
    }
  }
  return out;
}

/* ---------- KPIs ---------- */

/** How a KPI compares with something earlier. Edge cases are explicit so the screen can say the right thing. */
export type Compare =
  | { kind: 'change'; current: number; previous: number; /** "Oct", "Dec 2025", "2025 YTD" */ against: string }
  | { kind: 'first-month' }
  | { kind: 'no-previous' }
  | { kind: 'not-invoiced'; what: string }
  | { kind: 'no-prior-year'; year: number };

export type KpiId = 'total' | 'rent-parking' | 'utility' | 'ytd';

export interface Kpi {
  id: KpiId;
  label: string;
  value: number;
  compare: Compare;
  /** Second context line, e.g. "2 invoices" or "Rent 4 700 zł · Parking 450 zł". */
  sub: string;
}

export interface OverviewKpis {
  period: YearMonth;
  month: string;
  previous: YearMonth | null;
  cards: [Kpi, Kpi, Kpi, Kpi];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function compareTo(current: number, prev: MonthFigures | null, pick: (f: MonthFigures) => number, ym: YearMonth, onlyMonth: boolean): Compare {
  if (!prev) return onlyMonth ? { kind: 'first-month' } : { kind: 'no-previous' };
  return { kind: 'change', current, previous: pick(prev), against: relativeMonthLabel(prev.ym, ym) };
}

export function buildKpis(invoices: StoredInvoice[], period: YearMonth): OverviewKpis | null {
  const figs = monthFigures(invoices);
  const cur = figs.get(period);
  if (!cur) return null;
  const yms = Array.from(figs.keys()).sort();
  const { prev: prevYm } = neighbours(yms, period);
  const prev = prevYm ? figs.get(prevYm) ?? null : null;
  const onlyMonth = yms.length === 1;

  const total: Kpi = {
    id: 'total',
    label: `Total · ${cur.month}`,
    value: cur.total,
    compare: compareTo(cur.total, prev, (f) => f.total, period, onlyMonth),
    sub: plural(cur.invoiceCount, 'invoice'),
  };
  const rentParking: Kpi = {
    id: 'rent-parking',
    label: 'Rent + parking',
    value: cur.rentParking,
    compare: cur.hasRentParking ? compareTo(cur.rentParking, prev, (f) => f.rentParking, period, onlyMonth) : { kind: 'not-invoiced', what: 'rent or parking' },
    sub: `Rent ${fmtMoneyWhole(cur.rent)} · Parking ${fmtMoneyWhole(cur.parking)}`,
  };
  const utility: Kpi = {
    id: 'utility',
    label: 'Utilities',
    value: cur.utility,
    compare: cur.hasUtility ? compareTo(cur.utility, prev, (f) => f.utility, period, onlyMonth) : { kind: 'not-invoiced', what: 'utility' },
    sub: cur.hasUtility ? plural(cur.utilityCount, 'utility invoice') : '',
  };

  // Year to date: Jan 1 to the end of the selected month, against the same months of last year.
  const year = Number(period.slice(0, 4));
  const monthNo = Number(period.slice(5));
  const upTo = (y: number) => yms.filter((ym) => ym >= `${y}-01` && ym <= `${y}-${String(monthNo).padStart(2, '0')}`);
  const sum = (list: YearMonth[]) => round2(list.reduce((s, ym) => s + (figs.get(ym)?.total ?? 0), 0));
  const thisYear = upTo(year);
  const lastYear = upTo(year - 1);
  const ytdValue = sum(thisYear);
  let ytdCompare: Compare;
  if (lastYear.length === 0) ytdCompare = { kind: 'no-prior-year', year: year - 1 };
  else {
    const partial = lastYear.length < thisYear.length ? ` (${lastYear.length} of ${thisYear.length} months)` : '';
    ytdCompare = { kind: 'change', current: ytdValue, previous: sum(lastYear), against: `${year - 1} YTD${partial}` };
  }
  const ytd: Kpi = { id: 'ytd', label: `Year to date ${year}`, value: ytdValue, compare: ytdCompare, sub: plural(thisYear.length, 'month') };

  return { period, month: cur.month, previous: prevYm, cards: [total, rentParking, utility, ytd] };
}

/** Text the card shows for a comparison. `direction` drives the colour; the arrow and sign are always in the text too. */
export function describeCompare(c: Compare): { text: string; /** the text split where a narrow card may wrap: amount, then percentage */ parts: string[]; against: string; direction: 'up' | 'down' | 'flat' | 'none' } {
  const plain = (text: string) => ({ text, parts: [text], against: '', direction: 'none' as const });
  switch (c.kind) {
    case 'change': {
      const d = fmtDelta(c.current, c.previous);
      if (d.direction === 'flat') return { text: '— no change', parts: ['— no change'], against: `vs ${c.against}`, direction: 'flat' };
      const parts = [`${d.arrow} ${d.amount}`, ...(d.percent ? [d.percent] : [])];
      return { text: d.text, parts, against: `vs ${c.against}`, direction: d.direction };
    }
    case 'first-month':
      return plain('First month with data');
    case 'no-previous':
      return plain('No previous month');
    case 'not-invoiced':
      return plain(`No ${c.what} invoice this month`);
    case 'no-prior-year':
      return plain(`No ${c.year} data for comparison`);
  }
}

/* ---------- this month by item ---------- */

export interface BreakdownRow {
  key: string;
  label: string;
  /** The invoice wording for a utility (shown small), when there is one. */
  polish?: string;
  color: string;
  amount: number;
  /** The same item in the previous month with data; null when there is no previous month. */
  previous: number | null;
}

export interface Breakdown {
  period: YearMonth;
  month: string;
  previousMonth: string | null;
  /** Largest first. Rows with no amount this month are left out. */
  rows: BreakdownRow[];
  /** Sum of rows = the month total on the KPI card and the chart bar. */
  total: number;
  /** Set when the month has a manual heating value. */
  manual: { units: number; amount: number } | null;
}

function itemAmounts(invoices: StoredInvoice[], ym: YearMonth): Record<string, number> {
  const out: Record<string, number> = { Rent: 0, Parking: 0, Utility: 0, Manual: 0 };
  UTILITY_KEYS.forEach((k) => (out[k] = 0));
  for (const inv of invoices) {
    if (monthKeyToYm(getMonthYearFromDate(inv.invoice.issueDate)) !== ym) continue;
    const a = amountsByType(inv.invoice);
    out.Rent += a.Rent;
    out.Parking += a.Parking;
    if (inv.invoice.invoiceType === 'Utility') {
      out.Utility += a.Utility;
      for (const item of inv.invoice.lineItems) {
        if (isManualRow(item.description)) {
          out.Manual += item.grossValue ?? 0;
          continue;
        }
        for (const key of UTILITY_KEYS) if (matchesUtilityCategory(item.description, key)) out[key] += item.grossValue ?? 0;
      }
    }
  }
  return out;
}

/**
 * Rent, Parking, the five utility lines, the manual heating line (when the stored invoice has one) and "Other utility lines"
 * (what is left of the utility total) for one month. The rows add up to the month total.
 */
export function buildBreakdown(invoices: StoredInvoice[], period: YearMonth, manualValues: Record<string, number> = {}): Breakdown | null {
  const yms = dataMonthsYm(invoices);
  if (!yms.includes(period)) return null;
  const { prev } = neighbours(yms, period);
  const cur = itemAmounts(invoices, period);
  const before = prev ? itemAmounts(invoices, prev) : null;

  const rowFor = (key: string, label: string, color: string, polish?: string): BreakdownRow => {
    const known = (m: Record<string, number>) =>
      key === 'Other' ? m.Utility - m.Manual - UTILITY_KEYS.reduce((s, k) => s + m[k], 0) : m[key];
    return { key, label, polish, color, amount: round2(known(cur)), previous: before ? round2(known(before)) : null };
  };
  const rows: BreakdownRow[] = [
    rowFor('Rent', 'Rent', 'var(--rent)'),
    rowFor('Parking', 'Parking', 'var(--parking)'),
    ...UTILITY_KEYS.map((k: UtilityKey) => rowFor(k, k, UTILITY_META[k].color, UTILITY_META[k].polish)),
    rowFor('Manual', 'Manual heating', 'var(--central-heating)'),
    rowFor('Other', 'Other utility lines', 'var(--other)'),
  ].filter((r) => r.amount !== 0);
  rows.sort((a, b) => b.amount - a.amount);

  const month = ymToMonthKey(period);
  const units = manualValues[month] ?? 0;
  return {
    period,
    month,
    previousMonth: prev ? ymToMonthKey(prev) : null,
    rows,
    total: round2(rows.reduce((s, r) => s + r.amount, 0)),
    manual: units > 0 ? { units, amount: round2(units * HEATING_RATE) } : null,
  };
}

/* ---------- latest invoices ---------- */

export type InvoiceKind = 'Rent' | 'Parking' | 'Utility' | 'Other';

export interface LatestInvoice {
  stored: StoredInvoice;
  /** "Rent + Parking" for the combined invoice. */
  kinds: InvoiceKind[];
  label: string;
}

/** The `count` most recent invoices by issue date (newest first); invoices with an unreadable date come last. */
export function latestInvoices(invoices: StoredInvoice[], count = 5): LatestInvoice[] {
  const dated = invoices.map((stored, index) => ({ stored, index, time: parseDate(stored.invoice.issueDate)?.getTime() ?? Number.NEGATIVE_INFINITY }));
  dated.sort((a, b) => b.time - a.time || a.index - b.index);
  return dated.slice(0, count).map(({ stored }) => {
    const type = stored.invoice.invoiceType;
    const a = amountsByType(stored.invoice);
    const kinds: InvoiceKind[] =
      type === 'Rent' ? (a.Parking > 0 ? ['Rent', 'Parking'] : ['Rent']) : type === 'Parking' || type === 'Utility' ? [type] : ['Other'];
    return { stored, kinds, label: kinds.join(' + ') };
  });
}

/* ---------- chart range (6M · 12M · All) ---------- */

export type OverviewRange = '6m' | '12m' | 'all';

/** From the URL; anything unknown (including Analytics' custom ranges) is the default 12M. */
export function parseOverviewRange(param: string | null | undefined): OverviewRange {
  return param === '6m' || param === 'all' ? param : '12m';
}

export function overviewRangeSpec(r: OverviewRange): RangeSpec {
  return r === 'all' ? { kind: 'all' } : { kind: 'last', months: r === '6m' ? 6 : 12 };
}
