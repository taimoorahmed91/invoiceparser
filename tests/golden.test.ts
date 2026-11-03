import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import * as dates from '../lib/dates';
import { amountsByType, monthlyTotals, rentalSeries, utilityTypeSeries, parkingSeries, utilitySeries, yoySeries } from '../lib/analytics';
import { applyManualAdjustments, HEATING_RATE } from '../lib/adjustments';
import { toJson, toCsv, toExcelCsv } from '../lib/export';
import { UTILITY_CATEGORIES } from '../lib/categories';
import { combinedInvoice, utilityInvoice, manualCases, invoice, line } from './fixtures/synthetic';

const real = invoicesJson as StoredInvoice[];
const sets: [string, StoredInvoice[]][] = [
  ['empty', []], ['real', real], ['combined', [combinedInvoice]],
  ['synthetic utilities', [utilityInvoice]],
  ['mixed', [...real, combinedInvoice, utilityInvoice]],
  ['invalid dates and zero totals', [invoice([], 'Other', ''), invoice([line('Parking', 0)], 'Parking', 'bad'), invoice([], 'Rent', '01/01/2024')]],
];

// Fixture is an anonymised copy of data/invoices.json (amounts, dates and line items unchanged;
// names, addresses, NIP and bank account replaced). data/ is gitignored, so no live comparison.

describe.each(sets)('%s golden calculations', (_name, invoices) => {
  it('splits each invoice exactly as before', () => {
    expect(invoices.map(inv => amountsByType(inv.invoice))).toEqual(invoices.map(inv => legacy.amountsByType(inv.invoice)));
  });
  it('preserves monthly totals and chronological order', () => {
    expect(monthlyTotals(invoices)).toEqual(legacy.monthlyTotals(invoices));
  });
  it.each([
    ['Rent', rentalSeries, legacy.rentalSeries],
    ['Utility', utilityTypeSeries, legacy.utilityTypeSeries],
    ['Parking', parkingSeries, legacy.parkingSeries],
  ] as const)('preserves the %s series', (_type, current, previous) => {
    const oldTotals = legacy.monthlyTotals(invoices);
    const months = oldTotals.map(row => row.month);
    expect(current(monthlyTotals(invoices), months)).toEqual(previous(oldTotals, months));
  });
  it('preserves the YoY map', () => {
    expect(yoySeries(invoices)).toEqual(legacy.yoySeries(invoices));
  });
  for (const [metric, previous] of [
    ['gross', legacy.utilityGrossSeries], ['quantity', legacy.utilityQuantitySeries], ['unitPrice', legacy.utilityUnitPriceSeries],
  ] as const) {
    it.each(UTILITY_CATEGORIES.map((cat, index) => [cat.key, index] as const))(`preserves ${metric} / %s`, (_category, index) => {
      const months = legacy.monthlyTotals(invoices).map(row => row.month);
      expect(utilitySeries(invoices, months, metric)[index]).toEqual(previous(invoices, months)[index]);
    });
  }
  it.each(['none', 'manual'] as const)('preserves all export bytes (%s)', mode => {
    const values: Record<string, number> = mode === 'manual' ? { 'Nov 2026': 2, 'Jun 2025': 1.25 } : {};
    const adjusted = applyManualAdjustments(invoices, values);
    const oldAdjusted = legacy.applyManualAdjustments(invoices, values);
    expect(toJson(adjusted)).toBe(legacy.toJson(oldAdjusted));
    expect(toCsv(adjusted)).toBe(legacy.csvContent(oldAdjusted));
    expect(toExcelCsv(adjusted)).toBe(legacy.excelContent(oldAdjusted));
  });
});

describe('manual heating adjustment golden cases', () => {
  it.each(manualCases)('$name', ({ stored, values }) => {
    const original = JSON.stringify(stored);
    expect(applyManualAdjustments([stored], values)).toEqual(legacy.applyManualAdjustments([stored], values));
    expect(JSON.stringify(stored)).toBe(original);
  });
  it('retains the rate, floor-at-zero totals quirk, and duplicate manual-row behaviour', () => {
    expect(HEATING_RATE).toBe(76);
    const floor = manualCases.find(c => c.name === 'floor at zero')!;
    const adjusted = applyManualAdjustments([floor.stored], floor.values)[0];
    expect(adjusted.invoice.lineItems[0].grossValue).toBe(0);
    expect(adjusted.invoice.totals.grossTotal).toBe(760);
    const duplicate = applyManualAdjustments([utilityInvoice], { 'Nov 2026': 2 })[0];
    expect(duplicate.invoice.lineItems).toHaveLength(utilityInvoice.invoice.lineItems.length + 1);
  });
});

describe('date parsing golden cases', () => {
  it.each(['03/11/2026', '01/01/2024', '31/12/2025', '', 'bad', '1/13/2025', '31/02/2025', '1/2', '01/02/26', '1/2foo/2026', '1/0/2025', '1/2/2026/extra'])('%j', value => {
    expect(dates.getMonthFromDate(value)).toBe(legacy.getMonthFromDate(value));
    expect(dates.getMonthYearFromDate(value)).toBe(legacy.getMonthYearFromDate(value));
    expect(dates.parseDate(value)).toEqual(legacy.parseDate(value));
  });
});

it('splits November 2026 parking without changing the stored Rent type or total', () => {
  expect(amountsByType(combinedInvoice.invoice)).toEqual({ Rent: 2400, Parking: 200, Utility: 0 });
  expect(Object.values(amountsByType(combinedInvoice.invoice)).reduce((sum, value) => sum + value, 0)).toBe(combinedInvoice.invoice.totals.grossTotal);
  expect(combinedInvoice.invoice.invoiceType).toBe('Rent');
});

it('retains unweighted line-unit-price averaging and excludes manual rows', () => {
  const months = ['Nov 2026'];
  expect(utilitySeries([utilityInvoice], months, 'unitPrice')[0][0].value).toBe((25 / 2 + 60 / 3) / 2);
  expect(utilitySeries([utilityInvoice], months, 'gross')[3][0].value).toBe(330);
});
