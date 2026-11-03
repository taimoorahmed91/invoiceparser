/**
 * Data → Export (plan §4.8 item 2): the whole list, heating adjustments from manual values applied, in the three file formats the old
 * toolbar wrote. The text itself comes from lib/export.ts (the Phase-0 builders pinned by the golden tests); this file only decides which
 * rows go in, what the file is called and its type, exactly like the old handlers. Pure.
 */
import { applyManualAdjustments } from './adjustments';
import { toCsv, toExcelCsv, toJson } from './export';
import type { StoredInvoice } from './storage';

export type ExportKind = 'json' | 'csv' | 'xls';

export interface ExportFile {
  content: string;
  filename: string;
  mime: string;
}

const MIME: Record<ExportKind, string> = {
  json: 'application/json',
  csv: 'text/csv;charset=utf-8;',
  xls: 'application/vnd.ms-excel;charset=utf-8;',
};

/** `invoices-2026-11-03.json`: same name pattern (UTC date) as the old handlers. */
export function exportFileName(kind: ExportKind, date: Date = new Date()): string {
  return `invoices-${date.toISOString().split('T')[0]}.${kind}`;
}

export function buildExport(kind: ExportKind, invoices: StoredInvoice[], manualValues: Record<string, number>, date: Date = new Date()): ExportFile {
  const adjusted = applyManualAdjustments(invoices, manualValues);
  const content = kind === 'json' ? toJson(adjusted) : kind === 'csv' ? toCsv(adjusted) : toExcelCsv(adjusted);
  return { content, filename: exportFileName(kind, date), mime: MIME[kind] };
}

export const EXPORT_OPTIONS: ReadonlyArray<{ kind: ExportKind; label: string; description: string }> = [
  { kind: 'json', label: 'JSON', description: 'Every invoice with its line items. The file Import reads back.' },
  { kind: 'csv', label: 'CSV', description: 'One row per invoice: number, date, type, net, VAT, gross. Opens in Excel.' },
  { kind: 'xls', label: 'Excel-compatible (.xls)', description: 'The same summary saved as .xls. Excel may warn about the format; CSV is the safer choice.' },
];
