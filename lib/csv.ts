import { timeSeriesToTable, type TableSpec, type TimeSeriesSpec, type DataCell } from './dataView';

/**
 * Generic CSV for chart/table exports (plan §4.12.3). Same conventions as the Phase 0
 * invoice CSV in lib/export.ts: every cell quoted, "" escaping, UTF-8 BOM for Excel.
 * Numbers are written with a dot and 2 decimals (not the display format), so they re-import cleanly.
 */
export function tableToCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const cell = (v: string | number | null): string => {
    const text = v === null || v === undefined ? '' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v;
    return `"${String(text).replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  return '\uFEFF' + lines.join('\n');
}

function rawCell(v: DataCell | undefined): string | number | null {
  return v === undefined ? null : v;
}

export function tableSpecToCsv(table: TableSpec): string {
  return tableToCsv(
    table.columns.map((c) => c.label),
    table.rows.map((r) => table.columns.map((c) => rawCell(r[c.key]))),
  );
}

/** The data behind a chart: Month, one column per series, Total when it is shown in the table view. */
export function chartSpecToCsv(spec: TimeSeriesSpec): string {
  return tableSpecToCsv(timeSeriesToTable(spec));
}
