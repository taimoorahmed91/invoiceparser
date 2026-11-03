import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import { combinedInvoice, utilityInvoice, invoice, line, manualCases } from './fixtures/synthetic';
import {
  UTILITY_KEYS, UTILITY_META, buildUtilityRows, categoryUnits, displayUnit, isMetricAvailable, latestDelta, latestValue,
  metricCaption, metricFormatter, parseMetric, seriesStats,
} from '../lib/analyticsUtilities';
import { monthKeyToYm } from '../lib/analyticsMonthly';
import { UTILITY_CATEGORIES } from '../lib/categories';

const real = invoicesJson as StoredInvoice[];
const sets: [string, StoredInvoice[]][] = [
  ['empty', []], ['real', real], ['combined', [combinedInvoice]], ['synthetic utilities', [utilityInvoice]],
  ['mixed', [...real, combinedInvoice, utilityInvoice]],
  ['manual rows', manualCases.map((c) => c.stored)],
  ['invalid dates', [invoice([], 'Other', ''), invoice([line('Parking', 0)], 'Parking', 'bad'), invoice([], 'Rent', '01/01/2024')]],
];
const metrics = [
  ['cost', legacy.utilityGrossSeries], ['usage', legacy.utilityQuantitySeries], ['price', legacy.utilityUnitPriceSeries],
] as const;

describe.each(sets)('%s — all 15 utility metric × sub-type series equal the legacy arrays', (_n, invoices) => {
  it.each(metrics)('%s', (metric, previous) => {
    const oldMonths = legacy.monthlyTotals(invoices).map((r) => r.month).filter((k) => monthKeyToYm(k) !== null);
    const { rows } = buildUtilityRows(invoices, { kind: 'all' }, metric, { legacyZeros: true });
    expect(rows.map((r) => r.month)).toEqual(oldMonths);
    const old = previous(invoices, oldMonths);
    UTILITY_CATEGORIES.forEach((cat, index) => {
      expect(rows.map((r) => r[cat.key])).toEqual(old[index].map((p) => p.value));
    });
  });
});

describe('manual heating rows', () => {
  it('never reach the charts (cost, usage and price)', () => {
    for (const c of manualCases) {
      for (const [metric] of metrics) {
        const withManual = buildUtilityRows([c.stored], { kind: 'all' }, metric, { legacyZeros: true });
        const lines = c.stored.invoice.lineItems.filter((l) => !/manual (heating )?calculation/i.test(l.description));
        const stripped = { ...c.stored, invoice: { ...c.stored.invoice, lineItems: lines } };
        expect(buildUtilityRows([stripped], { kind: 'all' }, metric, { legacyZeros: true }).rows).toEqual(withManual.rows);
      }
    }
  });
});

describe('units come from the line items', () => {
  it('real data: m³ for water, kWh for electricity, GJ for heating, none for the flat waste fee', () => {
    const u = categoryUnits(real);
    expect(u['Cold Water']).toBe('m³');
    expect(u['Hot Water']).toBe('m³');
    expect(u.Electricity).toBe('kWh');
    expect(u['Central Heating']).toBe('GJ');
    expect(u['Waste Management']).toBe('');
  });
  it('maps parser units to display units; UNIT and blanks are no unit', () => {
    expect(displayUnit('M3')).toBe('m³');
    expect(displayUnit('KWH')).toBe('kWh');
    expect(displayUnit('GJ')).toBe('GJ');
    expect(displayUnit('UNIT')).toBe('');
    expect(displayUnit(undefined)).toBe('');
    expect(displayUnit('PCS')).toBe('pcs');
  });
  it('no unit when no line has a quantity', () => {
    expect(categoryUnits([invoice([line('Cold Water', 10, 0)], 'Utility')])['Cold Water']).toBe('');
  });
});

describe('gaps', () => {
  const water = (date: string) => invoice([{ ...line('Cold Water', 50, 2), unit: 'M3' }], 'Utility', date);
  it('months without that utility are null; months with no utility at all are __empty', () => {
    const { rows } = buildUtilityRows([water('05/01/2025'), invoice([line('Rent', 100)], 'Rent', '05/02/2025'), water('05/03/2025')], { kind: 'all' }, 'cost');
    expect(rows.map((r) => [r.month, r['Cold Water'], r['Hot Water'], r.__empty])).toEqual([
      ['Jan 2025', 50, null, 0],
      ['Feb 2025', null, null, 1],
      ['Mar 2025', 50, null, 0],
    ]);
  });
  it('the range limits the months', () => {
    const { rows, from, to } = buildUtilityRows(real, { kind: 'last', months: 6 }, 'cost');
    expect(rows).toHaveLength(6);
    expect(from && to).toBeTruthy();
  });
  it('empty data', () => {
    expect(buildUtilityRows([], { kind: 'all' }, 'cost').rows).toEqual([]);
  });
});

describe('metric helpers', () => {
  it('parses the URL value', () => {
    expect(parseMetric('usage')).toBe('usage');
    expect(parseMetric('price')).toBe('price');
    expect(parseMetric('x')).toBe('cost');
    expect(parseMetric(null)).toBe('cost');
  });
  it('Waste Management is hidden from usage and unit price only', () => {
    expect(isMetricAvailable('Waste Management', 'cost')).toBe(true);
    expect(isMetricAvailable('Waste Management', 'usage')).toBe(false);
    expect(isMetricAvailable('Waste Management', 'price')).toBe(false);
    expect(UTILITY_KEYS.filter((k) => k !== 'Waste Management').every((k) => (['cost', 'usage', 'price'] as const).every((m) => isMetricAvailable(k, m)))).toBe(true);
  });
  it('has a Polish invoice wording and a colour token for every sub-type', () => {
    expect(UTILITY_KEYS.map((k) => UTILITY_META[k].polish)).toEqual(['Zimna woda', 'Ciepła woda', 'Energia elektryczna', 'Ciepło', 'Gospodarka odpadami']);
    expect(UTILITY_KEYS.every((k) => /^var\(--[a-z-]+\)$/.test(UTILITY_META[k].color))).toBe(true);
  });
  it('formatters and captions carry the unit', () => {
    const NB = '\u00a0';
    expect(metricFormatter('cost', 'GJ')(1234.5)).toBe(`1${NB}234,50${NB}zł`);
    expect(metricFormatter('usage', 'GJ')(1.82)).toBe(`1,82${NB}GJ`);
    expect(metricFormatter('price', 'GJ')(88)).toBe(`88,00${NB}zł / GJ`);
    expect(metricCaption('usage', 'm³')).toBe('Quantity billed, m³');
    expect(metricCaption('price', 'kWh')).toBe('Average gross price per kWh, zł');
    expect(metricCaption('price', '')).toBe('Average gross price per unit, zł');
  });
});

describe('latest value, change and statistics', () => {
  const rows = [
    { month: 'Jan 2025', v: 10 }, { month: 'Feb 2025', v: null }, { month: 'Mar 2025', v: 30 }, { month: 'Apr 2025', v: 20 }, { month: 'May 2025', v: null },
  ];
  it('latest skips gaps and compares with the previous month that has a value', () => {
    const l = latestValue(rows, 'v');
    expect(l).toEqual({ value: 20, month: 'Apr 2025', previous: 30, previousMonth: 'Mar 2025' });
    expect(latestDelta(l, (n) => `${n} u`)?.text).toBe('▼ −10 u · −33,3\u00a0%');
  });
  it('one point → no change; none → null', () => {
    expect(latestDelta(latestValue([{ month: 'Jan 2025', v: 5 }], 'v'), String)).toBeNull();
    expect(latestValue([{ month: 'Jan 2025', v: null }], 'v')).toBeNull();
  });
  it('min / average / max ignore gaps', () => {
    expect(seriesStats(rows, 'v')).toEqual({ count: 3, min: { value: 10, month: 'Jan 2025' }, max: { value: 30, month: 'Mar 2025' }, avg: 20 });
    expect(seriesStats([], 'v')).toBeNull();
  });
});
