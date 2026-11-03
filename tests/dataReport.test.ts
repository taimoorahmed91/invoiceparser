import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import { combinedInvoice, invoice, line, utilityInvoice } from './fixtures/synthetic';
import { buildDataReport, invoiceListTable } from '../lib/dataReport';
import { cellText } from '../lib/dataView';
import { applyManualAdjustments } from '../lib/adjustments';
import { fmtMoney } from '../lib/format';

const real = invoicesJson as StoredInvoice[];
const textRows = (t: ReturnType<typeof invoiceListTable>) => t.rows.map((r) => t.columns.map((c) => cellText(c, r)));

describe('Data → PDF (all)', () => {
  it('nothing to report without invoices', () => expect(buildDataReport([], {})).toBeNull());

  it('two sections, each on its own page: the invoice list, then the manual heating values', () => {
    const r = buildDataReport(real, {})!;
    expect(r.title).toBe('Invoices Report');
    expect(r.sections.map((s) => [s.id, s.title])).toEqual([['invoices', 'Invoices'], ['manual', 'Manual heating values']]);
    expect(r.meta).toContain(`${real.length} invoices`);
    expect(r.meta).toContain('Heating adjustments from manual values included');
  });

  it('the full list is in the table: every invoice number, newest first, plus a Total row equal to the sum of all gross amounts', () => {
    const t = buildDataReport(real, {})!.sections[0].tables[0].table;
    const rows = textRows(t);
    expect(rows).toHaveLength(real.length + 1);
    expect(new Set(rows.slice(0, -1).map((r) => r[0]))).toEqual(new Set(real.map((i) => i.invoice.invoiceNumber)));
    const total = real.reduce((s, i) => s + i.invoice.totals.grossTotal, 0);
    expect(rows[rows.length - 1][0]).toBe('Total');
    expect(rows[rows.length - 1][5]).toBe(fmtMoney(Math.round(total * 100) / 100));
    expect(t.columns.map((c) => c.label)).toEqual(['Invoice', 'Issued', 'Type', 'Net', 'VAT', 'Gross']);
  });

  it('uses the same adjusted rows as the JSON / CSV / Excel exports (manual values applied)', () => {
    const values = { 'Mar 2025': 1.13, 'Sep 2025': 1.84 };
    const adjusted = applyManualAdjustments(real, values);
    const expected = textRows(invoiceListTable(adjusted));
    expect(textRows(buildDataReport(real, values)!.sections[0].tables[0].table)).toEqual(expected);
    // and for an invoice without a manual value in its month nothing moves
    const plain = textRows(buildDataReport(real, {})!.sections[0].tables[0].table);
    expect(plain.length).toBe(expected.length);
  });

  it('the combined invoice is labelled Rent + Parking', () => {
    const rows = textRows(invoiceListTable([combinedInvoice, utilityInvoice]));
    expect(rows.map((r) => r[2])).toContain('Rent + Parking');
  });

  it('no Total row when invoices are in different currencies (a sum would be meaningless)', () => {
    const eur = { ...utilityInvoice, id: 'e', invoice: { ...utilityInvoice.invoice, currency: 'EUR' } };
    const t = invoiceListTable([combinedInvoice, eur]);
    expect(t.rows).toHaveLength(2);
  });

  it('manual section lists the Utility months with units, adjustment and status; the rate is stated', () => {
    const r = buildDataReport([invoice([line('Central Heating', 500)], 'Utility', '03/10/2026'), combinedInvoice], { 'Oct 2026': 2 })!;
    const s = r.sections[1];
    expect(s.subtitle).toContain('76 zł per unit');
    const rows = textRows(s.tables[0].table);
    expect(rows).toEqual([['Oct 2026', '2', fmtMoney(152), 'Saved']]);
  });

  it('no Utility invoices → the manual section says so instead of an empty table', () => {
    const s = buildDataReport([combinedInvoice], {})!.sections[1];
    expect(s.tables).toEqual([]);
    expect(s.note).toBe('No Utility invoices yet.');
  });
});
