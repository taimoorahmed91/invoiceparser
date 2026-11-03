/**
 * "Report (PDF)" for Analytics (plan §4.12.4). Pure: decides what goes on the pages, from the same builders the tabs use,
 * so the report can never disagree with the screen.
 *   This tab  → that tab's chart(s) and table.
 *   All tabs  → Monthly costs → Utilities (Cost) → Year over year, each starting on its own page, one cover line.
 */
import { buildMonthlyRows, rangeLabel, type RangeSpec } from './analyticsMonthly';
import { monthlySingleSpec, monthlyStackedSpec, utilityAllSpec, utilityCardSpec, utilityMetricTableSpec } from './analyticsSpecs';
import { UTILITY_KEYS, UTILITY_META, buildUtilityRows, isMetricAvailable, metricCaption, type UtilityMetricKey } from './analyticsUtilities';
import { buildYoy, buildYoySpec, YOY_META, type YoyType } from './analyticsYoy';
import { resolveChartType, timeSeriesToTable, type ChartType, type TableSpec, type TimeSeriesSpec } from './dataView';
import { fmtDelta, fmtMoney } from './format';
import type { StoredInvoice } from './storage';

export type ReportScope = 'tab' | 'all';
export type ReportTab = 'monthly' | 'utilities' | 'yoy';

export interface ReportChart {
  title: string;
  subtitle?: string;
  spec: TimeSeriesSpec;
  chartType: ChartType;
  /** Half width: two per row. */
  half?: boolean;
}
export interface ReportTable {
  title: string;
  table: TableSpec;
}
export interface ReportSection {
  id: ReportTab;
  title: string;
  subtitle?: string;
  charts: ReportChart[];
  tables: ReportTable[];
  /** Shown instead of (or after) the content, e.g. "No invoices in this range". */
  note?: string;
}
export interface ReportData {
  /** "Analytics Report" or "Analytics Report · Monthly costs" */
  title: string;
  /** "Range: Dec 2025 – Nov 2026 · Filters: none" */
  meta: string;
  sections: ReportSection[];
}

export const TAB_TITLES: Record<ReportTab, string> = { monthly: 'Monthly costs', utilities: 'Utilities', yoy: 'Year over year' };

export interface ReportOptions {
  scope: ReportScope;
  tab: ReportTab;
  range: RangeSpec;
  metric: UtilityMetricKey;
  yoyType: YoyType;
}

function monthlySection(invoices: StoredInvoice[], range: RangeSpec): { section: ReportSection; label: string } {
  const result = buildMonthlyRows(invoices, range);
  const label = rangeLabel(result.from, result.to);
  const section: ReportSection = { id: 'monthly', title: TAB_TITLES.monthly, subtitle: `Rent, parking and utilities · ${label}`, charts: [], tables: [] };
  if (result.rows.every((r) => r.__empty === 1)) {
    section.note = 'No invoices in this range.';
    return { section, label };
  }
  const stacked = monthlyStackedSpec(result.rows);
  section.charts.push({ title: 'Monthly costs', spec: stacked, chartType: 'bar-stacked' });
  section.tables.push({ title: 'Monthly costs, table', table: timeSeriesToTable(stacked) });
  // Rent, Parking and Utility each on their own scale: parking is invisible next to rent on a shared axis.
  (['Rent', 'Parking', 'Utility'] as const).forEach((key) => section.charts.push({ title: key, subtitle: 'Own scale', spec: monthlySingleSpec(result.rows, key), chartType: 'bar-grouped', half: true }));
  return { section, label };
}

function utilitiesSection(invoices: StoredInvoice[], range: RangeSpec, metric: UtilityMetricKey): { section: ReportSection; label: string } {
  const result = buildUtilityRows(invoices, range, metric);
  const label = rangeLabel(result.from, result.to);
  const metricName = metric === 'cost' ? 'Cost' : metric === 'usage' ? 'Usage' : 'Unit price';
  const section: ReportSection = { id: 'utilities', title: `${TAB_TITLES.utilities} — ${metricName}`, subtitle: label, charts: [], tables: [] };
  if (result.rows.every((r) => r.__empty === 1)) {
    section.note = 'No utility invoices in this range.';
    return { section, label };
  }
  const keys = UTILITY_KEYS.filter((k) => isMetricAvailable(k, metric));
  if (metric === 'cost') section.charts.push({ title: 'All utilities', subtitle: 'The five sub-types stacked', spec: utilityAllSpec(result.rows), chartType: 'bar-stacked' });
  keys.forEach((key) =>
    section.charts.push({ title: key, subtitle: `${UTILITY_META[key].polish} · ${metricCaption(metric, result.units[key])}`, spec: utilityCardSpec(result, key, metric), chartType: 'bar-grouped', half: true }),
  );
  section.tables.push({ title: `${metricName} by month`, table: timeSeriesToTable(utilityMetricTableSpec(result, keys, metric)) });
  if (keys.length < UTILITY_KEYS.length) section.note = 'Waste Management is billed as a flat monthly fee, so it has no usage or unit-price chart. See it under Cost.';
  return { section, label };
}

function yoySection(invoices: StoredInvoice[], type: YoyType): { section: ReportSection; label: string } {
  const result = buildYoy(invoices, type);
  const label = result.years.length ? `${result.years[0]} – ${result.years[result.years.length - 1]}` : 'No data';
  const section: ReportSection = { id: 'yoy', title: `${TAB_TITLES.yoy} — ${YOY_META[type].label}`, subtitle: `${label} · the same months side by side · gross, zł`, charts: [], tables: [] };
  if (result.overlapMonths === 0) {
    section.note = 'Year-over-year needs the same month in two different years.';
    return { section, label };
  }
  const spec = buildYoySpec(result, type, { value: (n) => fmtMoney(n), delta: (c, p) => fmtDelta(c, p).text });
  section.charts.push({ title: `${YOY_META[type].label} cost, year over year`, spec, chartType: resolveChartType(undefined, spec) });
  section.tables.push({ title: 'By month', table: timeSeriesToTable(spec) });
  return { section, label };
}

/** null when there is nothing to report (no invoices at all). */
export function buildAnalyticsReport(invoices: StoredInvoice[], o: ReportOptions): ReportData | null {
  if (invoices.length === 0) return null;
  const tabs: ReportTab[] = o.scope === 'all' ? ['monthly', 'utilities', 'yoy'] : [o.tab];
  const sections: ReportSection[] = [];
  let rangeText = '';
  for (const tab of tabs) {
    // "All tabs" always reports Utilities as Cost; "This tab" reports the metric on screen.
    const built =
      tab === 'monthly' ? monthlySection(invoices, o.range)
      : tab === 'utilities' ? utilitiesSection(invoices, o.range, o.scope === 'all' ? 'cost' : o.metric)
      : yoySection(invoices, o.yoyType);
    sections.push(built.section);
    if (tab !== 'yoy' && !rangeText) rangeText = built.label;
    if (tab === 'yoy' && !rangeText) rangeText = `${built.label} (all invoices)`;
  }
  const title = o.scope === 'all' ? 'Analytics Report' : `Analytics Report · ${TAB_TITLES[o.tab]}`;
  const meta = `Range: ${rangeText}${o.scope === 'all' ? ' (Year over year always uses all years)' : ''}   ·   Filters: none`;
  return { title, meta, sections };
}
