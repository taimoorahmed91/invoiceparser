import { describe, expect, it } from 'vitest';
import { compareInvoices, grossDelta, normalizeDescription, quantityDelta, statusLabel, totalDelta, unitPriceDelta } from '../lib/compare';
import type { LineItem, ParsedInvoice } from '../lib/parseInvoice';
import type { StoredInvoice } from '../lib/storage';
import fixture from './fixtures/invoices.json';

/** The numbers of components/invoices/legacy/CompareDialog.tsx as it was before Phase 9b, copied verbatim (the frozen reference). */
function legacy(inv1: ParsedInvoice, inv2: ParsedInvoice) {
  const totals = (['netTotal', 'taxTotal', 'grossTotal'] as const).map((totalType) => {
    const value1 = inv1.totals[totalType];
    const value2 = inv2.totals[totalType];
    const diff = value2 - value1;
    const diffPercent = value1 !== 0 ? ((diff / value1) * 100).toFixed(1) : '0.0';
    return { totalType, value1, value2, diff, diffPercent };
  });
  const items1 = inv1.lineItems;
  const items2 = inv2.lineItems;
  const matchedItems: Array<{ item1: LineItem | null; item2: LineItem | null; description: string }> = [];
  const normalizeDesc = (desc: string) => desc.toLowerCase().trim();
  const map1 = new Map(items1.map(item => [normalizeDesc(item.description), item]));
  const map2 = new Map(items2.map(item => [normalizeDesc(item.description), item]));
  const allDescriptions = new Set([...items1.map(item => normalizeDesc(item.description)), ...items2.map(item => normalizeDesc(item.description))]);
  allDescriptions.forEach(desc => {
    matchedItems.push({ item1: map1.get(desc) || null, item2: map2.get(desc) || null, description: map1.get(desc)?.description || map2.get(desc)?.description || desc });
  });
  const rows = matchedItems.map(({ item1, item2, description }) => {
    if (item1 && item2) {
      const grossDiff = item2.grossValue - item1.grossValue;
      const unitPriceDiff = item2.netPrice - item1.netPrice;
      const quantityDiff = item2.quantity - item1.quantity;
      const quantityPercent = item1.quantity !== 0 ? ((quantityDiff / item1.quantity) * 100).toFixed(1) : '0.0';
      return { description, both: true, grossDiff, unitPriceDiff, quantityDiff, quantityPercent, g1: item1.grossValue, g2: item2.grossValue };
    }
    return { description, both: false, only: item1 ? 'A' : 'B', g1: item1?.grossValue ?? null, g2: item2?.grossValue ?? null };
  });
  return { totals, rows };
}

const line = (no: number, description: string, gross: number, extra: Partial<LineItem> = {}): LineItem => ({ no, description, netPrice: gross, quantity: 1, unit: 'PCS', netValue: gross, tax: '0%', grossValue: gross, ...extra });
const inv = (over: Partial<ParsedInvoice>): ParsedInvoice => ({
  invoiceNumber: 'FA/1', issueDate: '01/01/2026', saleDate: '', dueDate: '', invoiceType: 'Utility',
  seller: { name: '', address: '', nip: '' }, purchaser: { name: '', address: '' }, payment: { method: '', accountNumber: '' },
  lineItems: [], totals: { netTotal: 0, taxTotal: 0, grossTotal: 0 }, currency: 'PLN', ...over,
});

function check(a: ParsedInvoice, b: ParsedInvoice) {
  const got = compareInvoices(a, b);
  const ref = legacy(a, b);
  expect(got.totals.map(t => ({ key: t.key, a: t.a, b: t.b, diff: t.diff, pct: t.percent === null ? '0.0' : t.percent.toFixed(1) })))
    .toEqual(ref.totals.map(t => ({ key: t.totalType, a: t.value1, b: t.value2, diff: t.diff, pct: t.diffPercent })));
  expect(got.lines.length).toBe(ref.rows.length);
  got.lines.forEach((l, i) => {
    const r = ref.rows[i];
    expect(l.description).toBe(r.description);
    expect(l.status === 'both').toBe(r.both);
    if (r.both) {
      expect(l.grossDiff).toBe(r.grossDiff);
      expect(l.unitPriceDiff).toBe(r.unitPriceDiff);
      expect(l.quantityDiff).toBe(r.quantityDiff);
      expect((l.quantityPercent === null ? '0.0' : l.quantityPercent.toFixed(1))).toBe(r.quantityPercent);
    } else {
      expect(l.status).toBe(r.only === 'A' ? 'onlyA' : 'onlyB');
      expect(l.a?.grossValue ?? null).toBe(r.g1);
      expect(l.b?.grossValue ?? null).toBe(r.g2);
    }
  });
}

describe('compareInvoices equals the old comparison view', () => {
  it('matched, only-in-A and only-in-B lines; differences are B − A', () => {
    const a = inv({ totals: { netTotal: 100, taxTotal: 23, grossTotal: 123 }, lineItems: [line(1, 'Cold Water', 50, { quantity: 5, netPrice: 10 }), line(2, 'Rent', 73)] });
    const b = inv({ totals: { netTotal: 130, taxTotal: 30, grossTotal: 160 }, lineItems: [line(1, ' cold water ', 80, { quantity: 8, netPrice: 10 }), line(2, 'Electricity', 80)] });
    check(a, b);
    const c = compareInvoices(a, b);
    expect(c.lines.map(l => l.status)).toEqual(['both', 'onlyA', 'onlyB']);
    expect(c.counts).toEqual({ both: 1, onlyA: 1, onlyB: 1 });
    expect(c.totals[2].diff).toBe(37);
    expect(c.lines[0].description).toBe('Cold Water'); // A's wording
    expect(c.lines[0].quantityPercent).toBe(60);
  });
  it('a zero on A gives no percentage (the old view printed 0.0)', () => {
    const a = inv({ totals: { netTotal: 0, taxTotal: 0, grossTotal: 0 }, lineItems: [line(1, 'X', 0, { quantity: 0 })] });
    const b = inv({ totals: { netTotal: 10, taxTotal: 1, grossTotal: 11 }, lineItems: [line(1, 'X', 5, { quantity: 2 })] });
    check(a, b);
    expect(compareInvoices(a, b).totals[0].percent).toBeNull();
    expect(compareInvoices(a, b).lines[0].quantityPercent).toBeNull();
  });
  it('identical invoices: no differences', () => {
    const a = inv({ totals: { netTotal: 5, taxTotal: 1, grossTotal: 6 }, lineItems: [line(1, 'A', 6)] });
    check(a, a);
    const c = compareInvoices(a, a);
    expect(c.totals.every(t => t.diff === 0)).toBe(true);
    expect(totalDelta(c.totals[0], 'PLN').direction).toBe('flat');
  });
  it('every pair of neighbouring invoices in the fixture', () => {
    const list = (fixture as unknown as StoredInvoice[]).map(s => s.invoice);
    expect(list.length).toBeGreaterThan(10);
    for (let i = 0; i + 1 < list.length; i++) check(list[i], list[i + 1]);
  });
  it('the combined rent + parking invoice against a utility invoice', () => {
    const list = (fixture as unknown as StoredInvoice[]).map(s => s.invoice);
    const rent = list.find(i => i.invoiceType === 'Rent')!;
    const util = list.find(i => i.invoiceType === 'Utility')!;
    check(rent, util);
    check(util, rent);
  });
});

describe('details', () => {
  it('counts the lines hidden by same-description lines (the old behaviour keeps the last one)', () => {
    const a = inv({ lineItems: [line(1, 'Rent', 4922), line(2, 'Rent', 761), line(3, 'Rent', 52.09)] });
    const b = inv({ lineItems: [line(1, 'Rent', 5000)] });
    const c = compareInvoices(a, b);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0].a?.grossValue).toBe(52.09);
    expect(c.collapsed).toBe(2);
    expect(compareInvoices(b, b).collapsed).toBe(0);
  });
  it('flags different currencies', () => {
    expect(compareInvoices(inv({ currency: 'PLN' }), inv({ currency: 'EUR' })).sameCurrency).toBe(false);
    expect(compareInvoices(inv({}), inv({ currency: '' })).sameCurrency).toBe(true);
  });
  it('display text uses sign + arrow and the shared formatters', () => {
    const a = inv({ totals: { netTotal: 100, taxTotal: 0, grossTotal: 100 }, lineItems: [line(1, 'W', 100, { quantity: 10, netPrice: 10 })] });
    const b = inv({ totals: { netTotal: 80, taxTotal: 0, grossTotal: 80 }, lineItems: [line(1, 'W', 80, { quantity: 8, netPrice: 10 })] });
    const c = compareInvoices(a, b);
    expect(totalDelta(c.totals[2], 'PLN').text.replace(/\u00a0/g, ' ')).toBe('▼ −20,00 zł · −20,0 %');
    expect(grossDelta(c.lines[0], 'PLN')?.direction).toBe('down');
    expect(quantityDelta(c.lines[0])?.text).toContain('−2');
    expect(unitPriceDelta(c.lines[0], 'PLN')?.direction).toBe('flat');
    expect(grossDelta({ ...c.lines[0], status: 'onlyA' }, 'PLN')).toBeNull();
    expect(statusLabel('onlyB')).toBe('Only in B');
    expect(normalizeDescription('  Cold WATER ')).toBe('cold water');
  });
});

import { linesSpec, totalsSpec } from '../lib/compare';

describe('tables for export', () => {
  const a = inv({ totals: { netTotal: 100, taxTotal: 23, grossTotal: 123 }, lineItems: [line(1, 'Cold Water', 50, { quantity: 5, netPrice: 10, unit: 'M3' }), line(2, 'Rent', 73)] });
  const b = inv({ currency: 'PLN', totals: { netTotal: 130, taxTotal: 30, grossTotal: 160 }, lineItems: [line(1, 'cold water', 80, { quantity: 8, netPrice: 10, unit: 'M3' }), line(2, 'Electricity', 80)] });
  it('totals: A, B and the difference per amount', () => {
    const t = totalsSpec(compareInvoices(a, b));
    expect(t.columns.map(c => c.label)).toEqual(['Amount', 'A', 'B', 'Difference (B − A)']);
    expect(t.rows.map(r => r.item)).toEqual(['Net', 'VAT', 'Total']);
    expect(String(t.rows[2].delta).startsWith('▲')).toBe(true);
  });
  it('lines: one row per matched line, the side that has none is left empty', () => {
    const t = linesSpec(compareInvoices(a, b));
    expect(t.rows.map(r => r.in)).toEqual(['In both', 'Only in A', 'Only in B']);
    expect(t.rows[1].bGross).toBeNull();
    expect(t.rows[2].aQty).toBe('');
    expect(t.rows[0].delta).not.toBe('');
  });
  it('different currencies: no differences are printed', () => {
    const c = compareInvoices(a, inv({ currency: 'EUR', totals: b.totals, lineItems: b.lineItems }));
    expect(totalsSpec(c).rows.every(r => r.delta === '—')).toBe(true);
    expect(linesSpec(c).rows.every(r => r.delta === '')).toBe(true);
  });
});
