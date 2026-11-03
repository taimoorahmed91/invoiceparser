/**
 * Data for Analytics → Year over year (plan §4.7 tab 3). Pure.
 * Values come from lib/analytics `yoySeries` (month → year → Rent / Parking / Utility, built with `amountsByType`).
 * The old chart only knew Utility; Rent, Parking and Total use the same split, so a combined rent+parking invoice counts correctly.
 */
import { amountsByType, yoySeries } from './analytics';
import { getMonthYearFromDate, monthNames } from './dates';
import { MIN_POINTS_FOR_LINE, type DataRow, type DataSeries, type TimeSeriesSpec } from './dataView';
import type { StoredInvoice } from './storage';

export type YoyType = 'utility' | 'rent' | 'parking' | 'total';

export const YOY_TYPES: YoyType[] = ['utility', 'rent', 'parking', 'total'];

export const YOY_META: Record<YoyType, { label: string; color: string }> = {
  utility: { label: 'Utility', color: 'var(--utility)' },
  rent: { label: 'Rent', color: 'var(--rent)' },
  parking: { label: 'Parking', color: 'var(--parking)' },
  total: { label: 'Total', color: 'var(--ink)' },
};

export function parseYoyType(param: string | null | undefined): YoyType {
  return (YOY_TYPES as string[]).includes(param ?? '') ? (param as YoyType) : 'utility';
}

type Amounts = { Rent: number; Parking: number; Utility: number };

function pick(a: Amounts, type: YoyType): number {
  if (type === 'rent') return a.Rent;
  if (type === 'parking') return a.Parking;
  if (type === 'utility') return a.Utility;
  return a.Rent + a.Parking + a.Utility;
}

/**
 * "Jan|2026" when that month has something for the type: an invoice of that type, or a non-zero amount of it
 * (a combined rent + parking invoice has a Parking amount). A month with only a Rent invoice has no Utility data:
 * that is a gap, not a 0 that would pull the line down.
 */
function presenceOf(invoices: StoredInvoice[], type: YoyType): Set<string> {
  const set = new Set<string>();
  invoices.forEach((inv) => {
    const [month, year] = getMonthYearFromDate(inv.invoice.issueDate).split(' ');
    if (!year) return;
    const a = amountsByType(inv.invoice);
    const has =
      type === 'total' ||
      (type === 'rent' && (inv.invoice.invoiceType === 'Rent' || a.Rent !== 0)) ||
      (type === 'parking' && (inv.invoice.invoiceType === 'Parking' || a.Parking !== 0)) ||
      (type === 'utility' && (inv.invoice.invoiceType === 'Utility' || a.Utility !== 0));
    if (has) set.add(`${month}|${year}`);
  });
  return set;
}

export interface YoyRow extends DataRow {
  month: string; // "Jan" … "Dec"
}

export interface YoyResult {
  rows: YoyRow[];
  /** Years that have any invoice, oldest first. */
  years: string[];
  /** Months (Jan … Dec) in which at least two different years have a value. */
  overlapMonths: number;
}

/**
 * One row per calendar month, one column per year. A year without an invoice in that month is null (a gap, not 0).
 * `legacyZeros: true` reproduces the old Utility chart data exactly: only months that have data, only the years present
 * in that month, and 0 for a present year without Utility.
 */
export function buildYoy(invoices: StoredInvoice[], type: YoyType, opts: { legacyZeros?: boolean } = {}): YoyResult {
  const byMonth = yoySeries(invoices);
  const years = Array.from(new Set(Object.values(byMonth).flatMap((m) => Object.keys(m)))).sort();

  const present = opts.legacyZeros ? null : presenceOf(invoices, type);
  let overlapMonths = 0;
  const rows: YoyRow[] = [];
  monthNames.forEach((month) => {
    const monthData = byMonth[month] || {};
    const yearsPresent = Object.keys(monthData).sort();
    if (opts.legacyZeros) {
      const row: YoyRow = { month };
      yearsPresent.forEach((y) => {
        row[y] = pick(monthData[y], type) || 0;
      });
      if (Object.keys(row).length > 1) rows.push(row);
      return;
    }
    const row: YoyRow = { month };
    let withValue = 0;
    years.forEach((y) => {
      const has = Boolean(monthData[y]) && (present as Set<string>).has(`${month}|${y}`);
      row[y] = has ? pick(monthData[y], type) : null;
      if (has) withValue += 1;
    });
    if (withValue >= 2) overlapMonths += 1;
    rows.push(row);
  });
  return { rows, years, overlapMonths };
}

/** Number of months in which a year has a value. */
export function pointsInYear(rows: YoyRow[], year: string): number {
  return rows.filter((r) => typeof r[year] === 'number').length;
}

/**
 * Chart spec: one series per year, same hue as the selected type, fading with age
 * (newest solid 2.5 px, previous dashed 65 %, two years back dotted 40 %, older fainter).
 * A year with fewer than 4 months of data shows dots only: a line through 2 or 3 points would suggest a trend.
 */
export function buildYoySpec(result: YoyResult, type: YoyType, format: { value: (n: number) => string; delta: (current: number, previous: number) => string }): TimeSeriesSpec {
  const { years, rows } = result;
  const color = YOY_META[type].color;
  const newest = years.length - 1;
  const series: DataSeries[] = years.map((y, i) => {
    const age = newest - i;
    const pointsOnly = pointsInYear(rows, y) < MIN_POINTS_FOR_LINE;
    const style =
      age === 0 ? { width: 2.5, opacity: 1 }
      : age === 1 ? { width: 2, dash: '6 4', opacity: 0.65 }
      : age === 2 ? { width: 2, dash: '2 4', opacity: 0.4 }
      : { width: 2, dash: '2 4', opacity: 0.25 };
    return { key: y, label: y, color, style: { ...style, pointsOnly } };
  });
  const last = years[newest];
  const before = years[newest - 1];
  return {
    xKey: 'month',
    xLabel: 'Month',
    rows,
    series,
    unit: 'months',
    stackable: false,
    allowArea: false,
    defaultChartType: 'line',
    fallbackChartType: 'bar-grouped',
    endLabels: true,
    formatValue: format.value,
    emptyLabel: 'No invoice',
    deltaColumn: years.length >= 2 ? { label: `Change ${last} vs ${before}`, format: format.delta, mode: 'last-two-series' } : undefined,
  };
}
