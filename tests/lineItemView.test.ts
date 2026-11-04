import { describe, expect, it } from 'vitest';
import { computeLineItemView } from '../lib/adjustments';
import type { LineItem } from '../lib/parseInvoice';
import fixture from './fixtures/invoices.json';
import type { StoredInvoice } from '../lib/storage';

/** The row maths of components/LineItemTable.tsx as it was before Phase 9, copied verbatim (the frozen reference). */
function legacyRows(items: LineItem[], manualValue = 0) {
  const manualAdjustment = manualValue * 76;
  const centralHeatingIndex = items.findIndex(item =>
    item.description.toLowerCase() === 'central heating' ||
    item.description.toLowerCase().includes('central heating') ||
    item.description.toLowerCase().includes('ciepła'),
  );
  const hasManualHeatingRow = items.some(item => item.description.toLowerCase().includes('manual heating calculation'));
  const out = items.map((item, idx) => {
    const isCentralHeating = idx === centralHeatingIndex && manualValue > 0 && !hasManualHeatingRow;
    const adjustedGrossValue = isCentralHeating ? Math.max(0, item.grossValue - manualAdjustment) : item.grossValue;
    const adjustedNetValue = isCentralHeating ? Math.max(0, item.netValue - manualAdjustment) : item.netValue;
    const adjustedNetPrice = isCentralHeating && item.quantity > 0 ? adjustedGrossValue / item.quantity : item.netPrice;
    return { no: item.no, description: item.description, quantity: item.quantity, unit: item.unit, netPrice: adjustedNetPrice, netValue: adjustedNetValue, tax: item.tax, grossValue: adjustedGrossValue, adjusted: isCentralHeating };
  });
  if (manualValue > 0 && !hasManualHeatingRow) {
    out.push({ no: items.length + 1, description: `Manual Heating Calculation (${manualValue} × 76)`, quantity: 1, unit: 'UNIT', netPrice: manualValue * 76, netValue: manualValue * 76, tax: '0%', grossValue: manualValue * 76, adjusted: false });
  }
  return out;
}

const line = (no: number, description: string, gross: number, extra: Partial<LineItem> = {}): LineItem => ({
  no, description, netPrice: gross, quantity: 1, unit: 'PCS', netValue: gross, tax: '0%', grossValue: gross, ...extra,
});

const shape = (view: ReturnType<typeof computeLineItemView>) =>
  view.rows.map(r => ({ no: r.item.no, description: r.item.description, quantity: r.item.quantity, unit: r.item.unit, netPrice: r.item.netPrice, netValue: r.item.netValue, tax: r.item.tax, grossValue: r.item.grossValue, adjusted: r.kind === 'adjusted' }));

describe('computeLineItemView equals the old LineItemTable rows', () => {
  const cases: Array<[string, LineItem[], number]> = [
    ['no manual value', [line(1, 'Cold Water', 100), line(2, 'Central Heating', 500, { quantity: 2 })], 0],
    ['manual value with a heating row', [line(1, 'Cold Water', 100), line(2, 'Central Heating', 500, { quantity: 2 })], 1.82],
    ['Polish heating row', [line(1, 'Dostawa ciepła', 400, { quantity: 4 })], 2],
    ['stored manual row already present', [line(1, 'Central Heating', 500), line(2, 'Manual Heating Calculation (1 × 76)', 76)], 3],
    ['heating gross smaller than the adjustment (floor at 0)', [line(1, 'Central Heating', 50, { quantity: 5 })], 2],
    ['heating row with quantity 0 keeps its unit price', [line(1, 'Central Heating', 300, { quantity: 0, netPrice: 12 })], 1],
    ['manual value but no heating row', [line(1, 'Electricity', 200)], 1.5],
    ['no line items', [], 2],
  ];
  for (const [name, items, mv] of cases) {
    it(name, () => expect(shape(computeLineItemView(items, mv))).toEqual(legacyRows(items, mv)));
  }

  it('every invoice of the fixture, with and without a manual value', () => {
    const invoices = fixture as unknown as StoredInvoice[];
    expect(invoices.length).toBeGreaterThan(0);
    for (const inv of invoices) for (const mv of [0, 1.43, 40]) {
      expect(shape(computeLineItemView(inv.invoice.lineItems, mv))).toEqual(legacyRows(inv.invoice.lineItems, mv));
    }
  });
});

describe('computeLineItemView details', () => {
  it('marks kinds and reports the real reduction', () => {
    const v = computeLineItemView([line(1, 'Central Heating', 100, { quantity: 2 })], 2); // 152 > 100: floored
    expect(v.rows.map(r => r.kind)).toEqual(['adjusted', 'manual']);
    expect(v.rows[0].reduction).toBe(100);
    expect(v.adjustment).toBe(152);
    expect(v.rows[1].original).toBeNull();
  });
  it('does nothing without a manual value, and never changes the stored items', () => {
    const items = [line(1, 'Central Heating', 500)];
    const copy = JSON.parse(JSON.stringify(items));
    expect(computeLineItemView(items, 0).rows.every(r => r.kind === 'normal')).toBe(true);
    computeLineItemView(items, 3);
    expect(items).toEqual(copy);
  });
  it('reports a stored manual row and leaves everything as stored', () => {
    const v = computeLineItemView([line(1, 'Central Heating', 500), line(2, 'Manual Heating Calculation (1 × 76)', 76)], 3);
    expect(v.hasStoredManualRow).toBe(true);
    expect(v.rows.every(r => r.kind === 'normal')).toBe(true);
  });
});
