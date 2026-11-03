import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import { combinedInvoice, invoice, line, utilityInvoice } from './fixtures/synthetic';
import { parseWarnings } from '../lib/parseWarnings';
import { parseInvoiceText } from '../lib/parseInvoice';

const real = invoicesJson as StoredInvoice[];
const codes = (i: StoredInvoice['invoice']) => parseWarnings(i).map((w) => w.code);

describe('parse warnings', () => {
  it('real invoices parse clean: the only one flagged in the fixture is the genuine zero-total Jan 2025 invoice', () => {
    const flagged = real.filter((r) => parseWarnings(r.invoice).length > 0);
    expect(flagged.map((r) => [r.invoice.invoiceNumber, parseWarnings(r.invoice).map((w) => w.code)])).toEqual([['FA/MYS/352/01/2025', ['zero-total']]]);
    for (const r of [combinedInvoice, utilityInvoice]) expect(parseWarnings(r.invoice)).toEqual([]);
  });

  it('empty issue date', () => {
    const i = invoice([line('Rent', 100)], 'Rent', '').invoice;
    expect(codes(i)).toEqual(['no-date']);
  });

  it('an issue date that is not a real date (no month) counts as empty', () => {
    expect(codes(invoice([line('Rent', 100)], 'Rent', 'soon').invoice)).toEqual(['no-date']);
    expect(codes(invoice([line('Rent', 100)], 'Rent', '12/13/2026').invoice)).toEqual(['no-date']);
  });

  it('"Unknown" or empty invoice number', () => {
    const base = invoice([line('Rent', 100)], 'Rent', '03/11/2026').invoice;
    expect(codes({ ...base, invoiceNumber: 'Unknown' })).toEqual(['unknown-number']);
    expect(codes({ ...base, invoiceNumber: '  ' })).toEqual(['unknown-number']);
  });

  it('zero (or unreadable) gross total', () => {
    const base = invoice([line('Rent', 100)], 'Rent', '03/11/2026').invoice;
    expect(codes({ ...base, totals: { netTotal: 0, taxTotal: 0, grossTotal: 0 } })).toEqual(['zero-total']);
    expect(codes({ ...base, totals: { netTotal: 0, taxTotal: 0, grossTotal: NaN } })).toEqual(['zero-total']);
  });

  it('no line items', () => {
    const base = invoice([line('Rent', 100)], 'Rent', '03/11/2026').invoice;
    expect(codes({ ...base, lineItems: [] })).toEqual(['no-items']);
  });

  it('several at once, in a stable order, each with a plain sentence', () => {
    const w = parseWarnings(invoice([], 'Other', '').invoice);
    expect(w.map((x) => x.code)).toEqual(['no-date', 'zero-total', 'no-items']);
    expect(w.every((x) => /\.$/.test(x.message))).toBe(true);
  });

  it('text that is not an invoice at all raises all four, straight from the real parser', () => {
    const parsed = parseInvoiceText('hello world, this is a shopping list');
    expect(parsed.invoiceNumber).toBe('Unknown');
    expect(codes(parsed).sort()).toEqual(['no-date', 'no-items', 'unknown-number', 'zero-total']);
  });
});
