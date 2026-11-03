import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import { combinedInvoice, utilityInvoice, invoice, line } from './fixtures/synthetic';
import {
  buildMonthlyRows, monthKeyToYm, ymToMonthKey, ymAdd, ymRange, parseRange, serializeRange, resolveRange, monthsWithData, rangeLabel,
} from '../lib/analyticsMonthly';
import { timeSeriesToTable, cellText, type TimeSeriesSpec } from '../lib/dataView';
import { tableSpecToCsv } from '../lib/csv';
import { fmtDelta, fmtMoney } from '../lib/format';

const real = invoicesJson as StoredInvoice[];
const sets: [string, StoredInvoice[]][] = [
  ['empty', []], ['real', real], ['combined', [combinedInvoice]], ['synthetic utilities', [utilityInvoice]],
  ['mixed', [...real, combinedInvoice, utilityInvoice]],
  ['invalid dates and zero totals', [invoice([], 'Other', ''), invoice([line('Parking', 0)], 'Parking', 'bad'), invoice([], 'Rent', '01/01/2024')]],
];

describe.each(sets)('%s — Monthly costs series equal the legacy Rent / Parking / Utility arrays', (_n, invoices) => {
  it('same months, same values (golden, no gap filling)', () => {
    const oldTotals = legacy.monthlyTotals(invoices).filter((r) => monthKeyToYm(r.month) !== null);
    const months = oldTotals.map((r) => r.month);
    const { rows } = buildMonthlyRows(invoices, { kind: 'all' }, { fillGaps: false });
    expect(rows.map((r) => r.month)).toEqual(months);
    expect(rows.map((r) => r.Rent)).toEqual(legacy.rentalSeries(oldTotals, months).map((p) => p.value));
    expect(rows.map((r) => r.Parking)).toEqual(legacy.parkingSeries(oldTotals, months).map((p) => p.value));
    expect(rows.map((r) => r.Utility)).toEqual(legacy.utilityTypeSeries(oldTotals, months).map((p) => p.value));
    expect(rows.every((r) => r.__empty === 0)).toBe(true);
  });
  it('gap filling keeps every real month identical and adds only empty months', () => {
    const plain = buildMonthlyRows(invoices, { kind: 'all' }, { fillGaps: false }).rows;
    const filled = buildMonthlyRows(invoices, { kind: 'all' }).rows;
    expect(filled.filter((r) => r.__empty === 0)).toEqual(plain);
    expect(filled.filter((r) => r.__empty === 1).every((r) => r.Rent === null && r.Parking === null && r.Utility === null)).toBe(true);
  });
});

describe('combined rent + parking invoice', () => {
  it('is split into Rent and Parking and adds back to the invoice total', () => {
    const { rows } = buildMonthlyRows([combinedInvoice], { kind: 'all' });
    expect(rows).toHaveLength(1);
    expect(rows[0].Parking).toBeGreaterThan(0);
    expect((rows[0].Rent as number) + (rows[0].Parking as number) + (rows[0].Utility as number)).toBeCloseTo(combinedInvoice.invoice.totals.grossTotal, 2);
  });
});

describe('gaps', () => {
  const jan = invoice([line('Rent', 100)], 'Rent', '05/01/2025');
  const apr = invoice([line('Rent', 300)], 'Rent', '05/04/2025');
  it('months without an invoice become gap rows (null, not 0)', () => {
    const { rows } = buildMonthlyRows([jan, apr], { kind: 'all' });
    expect(rows.map((r) => [r.month, r.Rent, r.__empty])).toEqual([['Jan 2025', 100, 0], ['Feb 2025', null, 1], ['Mar 2025', null, 1], ['Apr 2025', 300, 0]]);
  });
});

describe('year-month helpers', () => {
  it('converts both ways', () => {
    expect(monthKeyToYm('Nov 2026')).toBe('2026-11');
    expect(monthKeyToYm('Unknown')).toBeNull();
    expect(monthKeyToYm('Xyz 2026')).toBeNull();
    expect(ymToMonthKey('2025-01')).toBe('Jan 2025');
  });
  it('adds months across years and lists inclusive ranges', () => {
    expect(ymAdd('2025-11', 3)).toBe('2026-02');
    expect(ymAdd('2025-01', -1)).toBe('2024-12');
    expect(ymRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(ymRange('2026-02', '2025-11')).toEqual([]);
  });
});

describe('range', () => {
  it('parses and serialises the URL value; unknown values fall back to 12M', () => {
    expect(parseRange('6m')).toEqual({ kind: 'last', months: 6 });
    expect(parseRange('all')).toEqual({ kind: 'all' });
    expect(parseRange('2025-01_2025-06')).toEqual({ kind: 'custom', from: '2025-01', to: '2025-06' });
    expect(parseRange('2025-06_2025-01')).toEqual({ kind: 'custom', from: '2025-01', to: '2025-06' });
    for (const bad of [null, undefined, '', 'nope', '2025-13_2025-14', '3m']) expect(parseRange(bad)).toEqual({ kind: 'last', months: 12 });
    for (const r of ['6m', '12m', 'all', '2025-01_2025-06']) expect(serializeRange(parseRange(r))).toBe(r);
  });
  const months = ['Jan 2025', 'Feb 2025', 'Nov 2025', 'Jan 2026'];
  it('last N months end at the latest month with data and never start before the first', () => {
    expect(resolveRange({ kind: 'last', months: 6 }, months)).toEqual({ from: '2025-08', to: '2026-01' });
    expect(resolveRange({ kind: 'last', months: 12 }, months)).toEqual({ from: '2025-02', to: '2026-01' });
    expect(resolveRange({ kind: 'last', months: 12 }, ['Mar 2025', 'Apr 2025'])).toEqual({ from: '2025-03', to: '2025-04' });
    expect(resolveRange({ kind: 'all' }, months)).toEqual({ from: '2025-01', to: '2026-01' });
    expect(resolveRange({ kind: 'last', months: 6 }, [])).toBeNull();
  });
  it('the range filters the rows; an empty range gives no rows', () => {
    const all = buildMonthlyRows(real, { kind: 'all' });
    const six = buildMonthlyRows(real, { kind: 'last', months: 6 });
    expect(six.rows).toHaveLength(6);
    expect(six.rows[5].month).toBe(all.rows[all.rows.length - 1].month);
    const none = buildMonthlyRows(real, { kind: 'custom', from: '2001-01', to: '2001-03' });
    expect(none.rows.every((r) => r.__empty === 1)).toBe(true);
    expect(buildMonthlyRows([], { kind: 'all' }).rows).toEqual([]);
  });
  it('labels', () => {
    expect(rangeLabel('2025-12', '2026-11')).toBe('Dec 2025 – Nov 2026');
    expect(rangeLabel('2025-12', '2025-12')).toBe('Dec 2025');
    expect(rangeLabel(null, null)).toBe('No data');
    expect(monthsWithData(real).length).toBeGreaterThan(5);
  });
});

describe('table view: Month · Rent · Parking · Utility · Total · Change vs previous month', () => {
  const rows = [
    { month: 'Jan 2025', Rent: 1000, Parking: 0, Utility: 100, __empty: 0 },
    { month: 'Feb 2025', Rent: null, Parking: null, Utility: null, __empty: 1 },
    { month: 'Mar 2025', Rent: 1000, Parking: 50, Utility: 150, __empty: 0 },
  ];
  const spec: TimeSeriesSpec = {
    xKey: 'month', xLabel: 'Month', rows, showTotal: true, formatValue: (n) => fmtMoney(n),
    series: [{ key: 'Rent', label: 'Rent', color: 'a' }, { key: 'Parking', label: 'Parking', color: 'b' }, { key: 'Utility', label: 'Utility', color: 'c' }],
    deltaColumn: { label: 'Change vs previous month', format: (c, p) => fmtDelta(c, p).text },
  };
  const t = timeSeriesToTable(spec);
  it('has the planned columns', () => {
    expect(t.columns.map((c) => c.label)).toEqual(['Month', 'Rent', 'Parking', 'Utility', 'Total', 'Change vs previous month']);
  });
  it('a month without an invoice shows dashes, not zero', () => {
    const feb = t.rows[1];
    expect(t.columns.slice(1).map((c) => cellText(c, feb))).toEqual(['—', '—', '—', '—', '—']);
  });
  it('change compares with the previous month that has data (skips the gap)', () => {
    expect(cellText(t.columns[5], t.rows[0])).toBe('—');
    expect(cellText(t.columns[5], t.rows[2])).toBe(fmtDelta(1200, 1100).text);
    expect(t.rows[2].__delta).toBe(100);
  });
  it('CSV carries raw numbers: Total and the numeric change', () => {
    const csv = tableSpecToCsv(t).slice(1).split('\n');
    expect(csv[0]).toBe('"Month","Rent","Parking","Utility","Total","Change vs previous month"');
    expect(csv[3]).toBe('"Mar 2025","1000","50","150","1200","100"');
    expect(csv[2]).toBe('"Feb 2025","","","","",""');
  });
});
