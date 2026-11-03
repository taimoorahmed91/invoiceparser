/**
 * Data → Export → "PDF (all)" (plan §4.12.4): the full invoice list, then the manual heating values, each section on its own page,
 * through the same print pipeline as every other report. Pure: it only decides what goes on the pages.
 */
import { applyManualAdjustments } from './adjustments';
import { latestInvoices } from './analyticsOverview';
import { buildManualRows, manualTableSpec } from './dataManual';
import { HEATING_RATE } from './adjustments';
import { getMonthYearFromDate } from './dates';
import type { DataRow, TableSpec } from './dataView';
import { fmtDate, fmtMoney } from './format';
import { monthKeyToYm } from './analyticsMonthly';
import type { ReportData, ReportSection } from './analyticsReport';
import type { StoredInvoice } from './storage';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "Jan 2025 – Nov 2026" over the issue dates, or null when no date can be read. */
function issuedSpan(invoices: StoredInvoice[]): string | null {
  const months = invoices
    .map((i) => getMonthYearFromDate(i.invoice.issueDate))
    .filter((m) => monthKeyToYm(m) !== null)
    .sort((a, b) => (monthKeyToYm(a)! < monthKeyToYm(b)! ? -1 : 1));
  if (months.length === 0) return null;
  return months[0] === months[months.length - 1] ? months[0] : `${months[0]} – ${months[months.length - 1]}`;
}

/** The invoice list as a table: newest first, "Rent + Parking" for the combined invoice, a Total row when every invoice is in one currency. */
export function invoiceListTable(invoices: StoredInvoice[]): TableSpec {
  const ordered = latestInvoices(invoices, invoices.length);
  const money = (key: string) => (row: DataRow) => (typeof row[key] === 'number' ? fmtMoney(row[key] as number, (row.currency as string) || 'PLN') : '');
  const rows: DataRow[] = ordered.map(({ stored, label }) => ({
    invoice: stored.invoice.invoiceNumber,
    issued: fmtDate(stored.invoice.issueDate),
    type: label,
    net: stored.invoice.totals.netTotal,
    tax: stored.invoice.totals.taxTotal,
    gross: stored.invoice.totals.grossTotal,
    currency: stored.invoice.currency || 'PLN',
  }));
  const currencies = new Set(rows.map((r) => r.currency));
  if (rows.length > 0 && currencies.size === 1) {
    const sum = (k: 'net' | 'tax' | 'gross') => round2(rows.reduce((s, r) => s + (r[k] as number), 0));
    rows.push({ invoice: 'Total', issued: '', type: '', net: sum('net'), tax: sum('tax'), gross: sum('gross'), currency: rows[0].currency });
  }
  return {
    columns: [
      { key: 'invoice', label: 'Invoice', align: 'left' },
      { key: 'issued', label: 'Issued', align: 'left' },
      { key: 'type', label: 'Type', align: 'left' },
      { key: 'net', label: 'Net', align: 'right', formatRow: money('net') },
      { key: 'tax', label: 'VAT', align: 'right', formatRow: money('tax') },
      { key: 'gross', label: 'Gross', align: 'right', formatRow: money('gross') },
    ],
    rows,
  };
}

/** null when there is nothing to report (no invoices). */
export function buildDataReport(invoices: StoredInvoice[], manualValues: Record<string, number>): ReportData | null {
  if (invoices.length === 0) return null;
  // Same rows as the other exports (JSON, CSV, Excel): heating adjustments from manual values applied.
  const adjusted = applyManualAdjustments(invoices, manualValues);
  const span = issuedSpan(invoices);
  const manualRows = buildManualRows(invoices, manualValues);

  const list: ReportSection = {
    id: 'invoices',
    title: 'Invoices',
    subtitle: `${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}${span ? ` · issued ${span}` : ''} · gross, net and VAT`,
    charts: [],
    tables: [{ title: 'All invoices', table: invoiceListTable(adjusted) }],
  };
  const manual: ReportSection = {
    id: 'manual',
    title: 'Manual heating values',
    subtitle: `Rate: ${HEATING_RATE} zł per unit · adjustment = units × ${HEATING_RATE}`,
    charts: [],
    tables: manualRows.length ? [{ title: 'By month', table: manualTableSpec(manualRows) }] : [],
    note: manualRows.length ? undefined : 'No Utility invoices yet.',
  };
  return {
    title: 'Invoices Report',
    meta: `${invoices.length} invoices${span ? ` · ${span}` : ''}   ·   Filters: none   ·   Heating adjustments from manual values included`,
    sections: [list, manual],
  };
}
