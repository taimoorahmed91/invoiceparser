/**
 * Pure rules for the shared chart / table toolbar (plan §4.11).
 * No React in here: the ≥ 4-point rule, which chart types are offered, the fallback when a
 * remembered choice is unavailable, and the table / CSV shape of a chart's data.
 */
export type ViewMode = 'chart' | 'table';
export type ChartType = 'bar-stacked' | 'bar-grouped' | 'line' | 'area';
/** What the user sees in the Bar | Line | Area switch. */
export type ChartKind = 'bar' | 'line' | 'area';

export const MIN_POINTS_FOR_LINE = 4;

export interface DataSeries {
  key: string;
  label: string;
  /** Any CSS colour, normally a token such as "var(--rent)". */
  color: string;
}

export type DataCell = string | number | null;
export type DataRow = Record<string, DataCell>;

/** Time-series data that can be drawn as a chart and shown as a table. */
export interface TimeSeriesSpec {
  xKey: string;
  /** Table header for the x column, e.g. "Month". */
  xLabel: string;
  series: DataSeries[];
  rows: DataRow[];
  /** Area is only offered for stacked / running quantities (Monthly costs, All utilities). */
  allowArea?: boolean;
  /** Adds a Total column to the table view (stacked data). */
  showTotal?: boolean;
  /** Unit word used in messages, default "months". */
  unit?: string;
  /** Formats a value for display (money, quantity). Defaults to String(). */
  formatValue?: (n: number) => string;
}

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format?: (v: DataCell) => string;
}

export interface TableSpec {
  columns: TableColumn[];
  rows: DataRow[];
  /** Print this table on a landscape page (wide tables). */
  wide?: boolean;
}

function num(v: DataCell | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Real observations only: a row counts when at least one series has a non-zero number.
 * Padded empty month slots (0 / null) do not count.
 */
export function populatedPoints(spec: Pick<TimeSeriesSpec, 'rows' | 'series'>): number {
  return spec.rows.filter((row) => spec.series.some((s) => {
    const v = num(row[s.key]);
    return v !== null && v !== 0;
  })).length;
}

export interface ChartKindOption {
  kind: ChartKind;
  /** Present when the option exists but cannot be used right now. */
  disabledReason?: string;
}

function lineReason(label: 'Line' | 'Area', n: number, unit: string): string {
  return `${label} needs at least ${MIN_POINTS_FOR_LINE} ${unit} with data — you have ${n}. Showing as bars instead.`;
}

/** Options for the Bar | Line | Area switch. Bar is always available; Line / Area need ≥ 4 points. Area only when allowed. */
export function chartKindOptions(spec: Pick<TimeSeriesSpec, 'rows' | 'series' | 'allowArea' | 'unit'>): ChartKindOption[] {
  const n = populatedPoints(spec);
  const unit = spec.unit ?? 'months';
  const enough = n >= MIN_POINTS_FOR_LINE;
  const out: ChartKindOption[] = [{ kind: 'bar' }, { kind: 'line', ...(enough ? {} : { disabledReason: lineReason('Line', n, unit) }) }];
  if (spec.allowArea) out.push({ kind: 'area', ...(enough ? {} : { disabledReason: lineReason('Area', n, unit) }) });
  return out;
}

export function chartTypeKind(t: ChartType): ChartKind {
  return t === 'line' ? 'line' : t === 'area' ? 'area' : 'bar';
}

export function isStackedType(t: ChartType): boolean {
  return t === 'bar-stacked' || t === 'area';
}

/** From a segmented selection (+ the Stacked chip) to the stored chart type. */
export function chartTypeFromKind(kind: ChartKind, stacked: boolean): ChartType {
  if (kind === 'line') return 'line';
  if (kind === 'area') return 'area';
  return stacked ? 'bar-stacked' : 'bar-grouped';
}

/**
 * The type actually drawn. A remembered choice that is unavailable right now (range shrank, Area not offered)
 * falls back to Bar (Stacked) for this render only — the stored preference is not touched, so it returns
 * once there are enough points again.
 */
export function resolveChartType(pref: ChartType | undefined, spec: Pick<TimeSeriesSpec, 'rows' | 'series' | 'allowArea' | 'unit'>): ChartType {
  const wanted = pref ?? 'bar-stacked';
  const option = chartKindOptions(spec).find((o) => o.kind === chartTypeKind(wanted));
  if (!option || option.disabledReason) return 'bar-stacked';
  return wanted;
}

/** The table behind a chart: x column, one column per series, optional total. */
export function timeSeriesToTable(spec: TimeSeriesSpec): TableSpec {
  const fmt = (v: DataCell): string => {
    const n = num(v);
    if (n === null) return v === null || v === undefined ? '—' : String(v);
    return spec.formatValue ? spec.formatValue(n) : String(n);
  };
  const columns: TableColumn[] = [
    { key: spec.xKey, label: spec.xLabel, align: 'left' },
    ...spec.series.map((s) => ({ key: s.key, label: s.label, align: 'right' as const, format: fmt })),
  ];
  const rows = spec.rows.map((r) => ({ ...r }));
  if (spec.showTotal && spec.series.length > 1) {
    columns.push({ key: '__total', label: 'Total', align: 'right', format: fmt });
    rows.forEach((r) => {
      r.__total = spec.series.reduce((sum, s) => sum + (num(r[s.key]) ?? 0), 0);
    });
  }
  return { columns, rows, wide: columns.length > 5 };
}

export function cellText(col: TableColumn, row: DataRow): string {
  const v = row[col.key] ?? null;
  if (col.format) return col.format(v);
  return v === null || v === undefined ? '—' : String(v);
}

/** Filename slug: "Utilities → Cost → Central Heating" → "utilities-cost-central-heating". Keeps Polish letters readable. */
export function slugify(text: string): string {
  const map: Record<string, string> = { ł: 'l', Ł: 'l', ą: 'a', ć: 'c', ę: 'e', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', Ą: 'a', Ć: 'c', Ę: 'e', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z' };
  return text
    .replace(/[łŁąćęńóśźżĄĆĘŃÓŚŹŻ]/g, (c) => map[c])
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'panel';
}

/** invoice-parser-{panel-slug}-{yyyy-mm-dd}.{ext} (plan §4.12.3). Date is local. */
export function exportFilename(panelTitle: string, ext: 'csv' | 'png' | 'pdf', date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `invoice-parser-${slugify(panelTitle)}-${y}-${m}-${d}.${ext}`;
}
