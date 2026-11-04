import { describe, expect, it } from 'vitest';
import { computeLineItemView } from '../lib/adjustments';
import { detailGroups, hasPolish, invoiceHref, lineItemsSpec, neighbourAfterRemove, neighbours, readDrawerId, withDrawerParam } from '../lib/invoiceDetail';
import type { ParsedInvoice } from '../lib/parseInvoice';

const inv = (over: Partial<ParsedInvoice> = {}): ParsedInvoice => ({
  invoiceNumber: 'FA/MYS/124/11/2026', issueDate: '18/11/2026', saleDate: '', dueDate: '02/12/2026', invoiceType: 'Rent',
  seller: { name: 'Seller sp. z o.o.', address: '', nip: '123' }, purchaser: { name: '', address: '' },
  payment: { method: 'transfer', accountNumber: 'PL12 3456' }, lineItems: [], totals: { netTotal: 0, taxTotal: 0, grossTotal: 0 }, currency: 'PLN', ...over,
});

describe('deep link', () => {
  it('builds and reads ?invoice=', () => {
    const href = invoiceHref('inv_1 a/b');
    expect(href).toBe('/invoices?invoice=inv_1%20a%2Fb');
    expect(readDrawerId(href.split('?')[1])).toBe('inv_1 a/b');
    expect(readDrawerId('')).toBeNull();
    expect(readDrawerId('?invoice=')).toBeNull();
  });
  it('keeps the list filters when the drawer opens / closes', () => {
    expect(withDrawerParam('?type=Utility&from=2026-01', 'x1')).toBe('type=Utility&from=2026-01&invoice=x1');
    expect(withDrawerParam('type=Utility&invoice=x1', 'x2')).toBe('type=Utility&invoice=x2');
    expect(withDrawerParam('type=Utility&invoice=x1', null)).toBe('type=Utility');
    expect(withDrawerParam('', null)).toBe('');
  });
});

describe('detailGroups', () => {
  it('leaves empty fields out', () => {
    const g = detailGroups(inv());
    expect(g.dates.map(f => f.label)).toEqual(['Issued', 'Due date']);
    expect(g.dates[0].value).toBe('18 Nov 2026');
    expect(g.payment.map(f => f.label)).toEqual(['Payment method', 'Bank account']);
    expect(g.payment[1].copy).toBe(true);
    expect(g.seller.map(f => f.label)).toEqual(['Name', 'NIP']);
    expect(g.purchaser).toEqual([]);
  });
  it('an invoice with nothing stored yields no fields at all', () => {
    const g = detailGroups(inv({ issueDate: '', dueDate: '', seller: { name: '', address: '', nip: '' }, payment: { method: '', accountNumber: '' } }));
    expect([...g.dates, ...g.payment, ...g.seller, ...g.purchaser]).toEqual([]);
  });
});

describe('hasPolish', () => {
  it('spots Polish letters', () => {
    expect(hasPolish('Dostawa ciepła')).toBe(true);
    expect(hasPolish('Central Heating')).toBe(false);
  });
});

describe('lineItemsSpec', () => {
  it('has the 7 columns and the manual rows labelled', () => {
    const view = computeLineItemView([{ no: 1, description: 'Central Heating', netPrice: 500, quantity: 1, unit: 'GJ', netValue: 500, tax: '8%', grossValue: 500 }], 2);
    const t = lineItemsSpec(view, 'PLN');
    expect(t.columns.map(c => c.label)).toEqual(['#', 'Description', 'Qty', 'Unit price', 'Net', 'Tax', 'Gross']);
    expect(t.rows[0].description).toBe('Central Heating (adjusted)');
    expect(t.rows[1].description).toContain('Manual Heating Calculation (2 × 76) (added manually)');
    expect(t.rows[0].gross).toBeCloseTo(348);
    expect(t.rows[1].gross).toBe(152);
  });
});

describe('neighbours', () => {
  const ids = ['a', 'b', 'c'];
  it('steps through the list', () => {
    expect(neighbours(ids, 'b')).toEqual({ position: 2, count: 3, prevId: 'a', nextId: 'c' });
    expect(neighbours(ids, 'a').prevId).toBeNull();
    expect(neighbours(ids, 'c').nextId).toBeNull();
  });
  it('an invoice outside the list has no position', () => {
    expect(neighbours(ids, 'zzz')).toEqual({ position: 0, count: 3, prevId: null, nextId: null });
  });
  it('after a removal focus goes to the next, else the previous', () => {
    expect(neighbourAfterRemove(ids, 'b')).toBe('c');
    expect(neighbourAfterRemove(ids, 'c')).toBe('b');
    expect(neighbourAfterRemove(['a'], 'a')).toBeNull();
    expect(neighbourAfterRemove(ids, 'q')).toBeNull();
  });
});
