/**
 * Chart/table specs for the three Analytics tabs, built in one place so the on-screen cards and the Analytics report (PDF)
 * show exactly the same numbers. Pure.
 */
import { fmtDelta, fmtMoney } from './format';
import type { TimeSeriesSpec } from './dataView';
import type { MonthlyRow } from './analyticsMonthly';
import {
  UTILITY_KEYS, UTILITY_META, latestDelta, metricFormatter, metricYTick, type UtilityKey, type UtilityMetricKey, type UtilityResult, type UtilityRow,
} from './analyticsUtilities';

const moneyDelta = (c: number, p: number) => fmtDelta(c, p).text;

/* ---------- Monthly costs ---------- */

const MONTHLY_SERIES = {
  Rent: { key: 'Rent', label: 'Rent', color: 'var(--rent)' },
  Parking: { key: 'Parking', label: 'Parking', color: 'var(--parking)' },
  Utility: { key: 'Utility', label: 'Utility', color: 'var(--utility)' },
} as const;

export type MonthlyKey = keyof typeof MONTHLY_SERIES;

function monthlyBase(rows: MonthlyRow[]) {
  return {
    xKey: 'month',
    xLabel: 'Month',
    rows,
    formatValue: (n: number) => fmtMoney(n),
    deltaColumn: { label: 'Change vs previous month', format: moneyDelta },
  };
}

export function monthlyStackedSpec(rows: MonthlyRow[]): TimeSeriesSpec {
  return { ...monthlyBase(rows), series: [MONTHLY_SERIES.Rent, MONTHLY_SERIES.Parking, MONTHLY_SERIES.Utility], allowArea: true, showTotal: true, totalLabels: true };
}

export function monthlySingleSpec(rows: MonthlyRow[], key: MonthlyKey): TimeSeriesSpec {
  return { ...monthlyBase(rows), series: [MONTHLY_SERIES[key]] };
}

/* ---------- Utilities ---------- */

/** One small card: one sub-type, one metric. */
export function utilityCardSpec(result: UtilityResult, key: UtilityKey, metric: UtilityMetricKey): TimeSeriesSpec {
  const unit = result.units[key];
  const fmt = metricFormatter(metric, unit);
  return {
    xKey: 'month',
    xLabel: 'Month',
    rows: result.rows.map((r) => ({ month: r.month, value: r[key], __empty: r[key] === null ? 1 : 0 })),
    series: [{ key: 'value', label: key, color: UTILITY_META[key].color }],
    formatValue: fmt,
    yTick: metricYTick(metric),
    emptyLabel: 'No utility invoice',
    unit: 'months',
    deltaColumn: { label: 'Change vs previous month', format: (c, p) => latestDelta({ value: c, month: '', previous: p, previousMonth: '' }, fmt)?.text ?? '—' },
  };
}

/** The five sub-types stacked (Cost only). */
export function utilityAllSpec(rows: UtilityRow[]): TimeSeriesSpec {
  return {
    xKey: 'month',
    xLabel: 'Month',
    rows,
    series: UTILITY_KEYS.map((k) => ({ key: k, label: k, color: UTILITY_META[k].color })),
    allowArea: true,
    showTotal: true,
    totalLabels: true,
    formatValue: (n) => fmtMoney(n),
    emptyLabel: 'No utility invoice',
    deltaColumn: { label: 'Change vs previous month', format: moneyDelta },
  };
}

/** A plain table of one metric for all sub-types that have it (for the report). */
export function utilityMetricTableSpec(result: UtilityResult, keys: UtilityKey[], metric: UtilityMetricKey): TimeSeriesSpec {
  return {
    xKey: 'month',
    xLabel: 'Month',
    rows: result.rows,
    series: keys.map((k) => ({ key: k, label: k, color: UTILITY_META[k].color })),
    formatValue: (n) => metricFormatter(metric, '')(n),
    // each column keeps its own unit text through its card; the table shows plain numbers with the metric's money/quantity style
    showTotal: metric === 'cost',
  };
}
