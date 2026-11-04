import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import { combinedInvoice, invoice, line, utilityInvoice } from './fixtures/synthetic';
import {
  buildBreakdown, buildKpis, dataMonthsYm, describeCompare, latestInvoices, monthFigures, neighbours, relativeMonthLabel, resolvePeriod,
} from '../lib/analyticsOverview';
import { buildMonthlyRows } from '../lib/analyticsMonthly';
import { monthlyStackedSpec } from '../lib/analyticsSpecs';
import { timeSeriesToTable } from '../lib/dataView';
import { HEATING_RATE } from '../lib/adjustments';
import { fmtMoneyWhole } from '../lib/format';

const real = invoicesJson as StoredInvoice[];
const inv = (type: StoredInvoice['invoice']['invoiceType'], date: string, gross: number, lines = [line('x', gross)]) => invoice(lines, type, date);
const sets: [string, StoredInvoice[]][] = [
  ['fixture', real],
  ['fixture + combined Nov 2026 + utility Nov 2026', [...real, combinedInvoice, utilityInvoice]],
];

describe.each(sets)('%s: KPI = chart bar = table total = by-item sum', (_n, invoices) => {
  const yms = dataMonthsYm(invoices);

  it('has months to check', () => expect(yms.length).toBeGreaterThan(3));

  it('Total KPI equals the legacy monthly total, the chart bar and the table Total for every month', () => {
    const chart = buildMonthlyRows(invoices, { kind: 'all' });
    const table = timeSeriesToTable(monthlyStackedSpec(chart.rows));
    const oldTotals = new Map(legacy.monthlyTotals(invoices).map((r) => [r.month, r.Rent + r.Parking + r.Utility]));
    for (const ym of yms) {
      const k = buildKpis(invoices, ym)!;
      const row = chart.rows.find((r) => monthFigures(invoices).get(ym)!.month === r.month)!;
      const barSum = (row.Rent ?? 0) + (row.Parking ?? 0) + (row.Utility ?? 0);
      const tableRow = table.rows.find((r) => r.month === row.month)!;
      expect(k.cards[0].value).toBeCloseTo(oldTotals.get(k.month)!, 6);
      expect(k.cards[0].value).toBeCloseTo(barSum, 6);
      expect(k.cards[0].value).toBeCloseTo(tableRow.__total as number, 6);
      // Rent + parking and Utilities cards add up to the Total card
      expect(k.cards[1].value + k.cards[2].value).toBeCloseTo(k.cards[0].value, 6);
      // the by-item list adds up to the same number
      expect(buildBreakdown(invoices, ym)!.total).toBeCloseTo(k.cards[0].value, 2);
    }
  });

  it('Rent + parking and Utilities KPIs equal the chart series', () => {
    const chart = buildMonthlyRows(invoices, { kind: 'all' });
    for (const ym of yms) {
      const k = buildKpis(invoices, ym)!;
      const row = chart.rows.find((r) => r.month === k.month)!;
      expect(k.cards[1].value).toBeCloseTo((row.Rent as number) + (row.Parking as number), 6);
      expect(k.cards[2].value).toBeCloseTo(row.Utility as number, 6);
    }
  });

  it('Year to date equals the sum of the monthly totals of that year up to the month', () => {
    const old = legacy.monthlyTotals(invoices);
    for (const ym of yms) {
      const year = ym.slice(0, 4);
      const expected = old
        .filter((r) => toYm(r.month).startsWith(year) && toYm(r.month) <= ym)
        .reduce((s, r) => s + r.Rent + r.Parking + r.Utility, 0);
      expect(buildKpis(invoices, ym)!.cards[3].value).toBeCloseTo(expected, 6);
    }
  });

  it('by-item rows are largest first and the rest is never negative', () => {
    for (const ym of yms) {
      const b = buildBreakdown(invoices, ym)!;
      expect(b.rows.find((r) => r.key === 'Other')?.amount ?? 0).toBeGreaterThanOrEqual(0);
      expect(b.rows.map((r) => r.amount)).toEqual([...b.rows.map((r) => r.amount)].sort((a, c) => c - a));
    }
  });
});

function toYm(month: string): string {
  const [m, y] = month.split(' ');
  return `${y}-${String(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m) + 1).padStart(2, '0')}`;
}

describe('combined invoice (Rent + Parking on one invoice) in KPI 2 and the breakdown', () => {
  const set = [combinedInvoice]; // type Rent, 03/11/2026: Rent 2400 + two parking lines 123 + 77
  it('KPI 2 sums rent and parking; sub line splits them', () => {
    const k = buildKpis(set, '2026-11')!;
    expect(k.cards[0].value).toBe(2600);
    expect(k.cards[1].value).toBe(2600);
    expect(k.cards[1].sub).toBe(`Rent ${fmtMoneyWhole(2400)} · Parking ${fmtMoneyWhole(200)}`);
    expect(k.cards[2].value).toBe(0);
  });
  it('breakdown lists Rent and Parking separately, nothing else', () => {
    const b = buildBreakdown(set, '2026-11')!;
    expect(b.rows.map((r) => [r.key, r.amount])).toEqual([['Rent', 2400], ['Parking', 200]]);
    expect(b.total).toBe(2600);
  });
  it('the invoice is labelled Rent + Parking in the latest list', () => {
    expect(latestInvoices(set)[0]).toMatchObject({ kinds: ['Rent', 'Parking'], label: 'Rent + Parking' });
  });
  it('older separate invoices give the same split', () => {
    const separate = [inv('Rent', '03/10/2026', 2400), inv('Parking', '03/10/2026', 200)];
    const k = buildKpis(separate, '2026-10')!;
    expect(k.cards[1].value).toBe(2600);
    expect(k.cards[1].sub).toBe(buildKpis(set, '2026-11')!.cards[1].sub);
  });
});

describe('period', () => {
  const yms = ['2025-01', '2025-03', '2026-02'];
  it('defaults to the latest month with data', () => expect(resolvePeriod(null, yms)).toBe('2026-02'));
  it('keeps a valid month that has data', () => expect(resolvePeriod('2025-03', yms)).toBe('2025-03'));
  it('falls back for a month without data, junk, or no param', () => {
    expect(resolvePeriod('2025-02', yms)).toBe('2026-02');
    expect(resolvePeriod('banana', yms)).toBe('2026-02');
    expect(resolvePeriod('2026-13', yms)).toBe('2026-02');
    expect(resolvePeriod(undefined, yms)).toBe('2026-02');
  });
  it('null with no data at all', () => expect(resolvePeriod('2026-01', [])).toBeNull());
  it('neighbours skip gaps and stop at the ends', () => {
    expect(neighbours(yms, '2025-03')).toEqual({ prev: '2025-01', next: '2026-02' });
    expect(neighbours(yms, '2025-01')).toEqual({ prev: null, next: '2025-03' });
    expect(neighbours(yms, '2026-02')).toEqual({ prev: '2025-03', next: null });
    expect(neighbours(yms, '2024-01')).toEqual({ prev: null, next: null });
  });
  it('relative month label adds the year only when it differs', () => {
    expect(relativeMonthLabel('2026-10', '2026-11')).toBe('Oct');
    expect(relativeMonthLabel('2025-12', '2026-01')).toBe('Dec 2025');
  });
  it('the latest month on the real fixture is the default', () => {
    const ym = resolvePeriod(null, dataMonthsYm(real))!;
    expect(ym).toBe('2026-01');
  });
  it('buildKpis / buildBreakdown return null for a month without data', () => {
    expect(buildKpis(real, '2024-05')).toBeNull();
    expect(buildBreakdown(real, '2024-05')).toBeNull();
    expect(buildKpis([], '2026-01')).toBeNull();
  });
});

describe('delta edge cases', () => {
  it('one month of data → "First month with data" on the month cards', () => {
    const k = buildKpis([inv('Rent', '05/03/2026', 100)], '2026-03')!;
    expect(k.cards[0].compare).toEqual({ kind: 'first-month' });
    expect(describeCompare(k.cards[0].compare).text).toBe('First month with data');
    expect(k.cards[3].compare).toEqual({ kind: 'no-prior-year', year: 2025 });
    expect(describeCompare(k.cards[3].compare).text).toBe('No 2025 data for comparison');
  });
  it('first of several months → "No previous month"', () => {
    const k = buildKpis([inv('Rent', '05/03/2026', 100), inv('Rent', '05/04/2026', 120)], '2026-03')!;
    expect(k.cards[0].compare).toEqual({ kind: 'no-previous' });
    expect(describeCompare(k.cards[0].compare).text).toBe('No previous month');
  });
  it('previous = 0: absolute change only, no percentage', () => {
    // March has rent, April has rent and (for the first time) a utility bill: utility previous is 0
    const set = [inv('Rent', '05/03/2026', 100), inv('Rent', '05/04/2026', 100), inv('Utility', '07/04/2026', 50, [line('Electricity', 50)])];
    const k = buildKpis(set, '2026-04')!;
    expect(k.cards[2].compare).toMatchObject({ kind: 'change', current: 50, previous: 0 });
    const d = describeCompare(k.cards[2].compare);
    expect(d.text).toBe('▲ +50,00\u00a0zł');
    expect(d.text).not.toContain('%');
    expect(d.direction).toBe('up');
    expect(d.against).toBe('vs Mar');
  });
  it('no change → "— no change"', () => {
    const k = buildKpis([inv('Rent', '05/03/2026', 100), inv('Rent', '05/04/2026', 100)], '2026-04')!;
    const d = describeCompare(k.cards[1].compare);
    expect(d).toMatchObject({ text: '— no change', direction: 'flat', against: 'vs Mar' });
  });
  it('an increase and a decrease carry sign, arrow and percentage in the text', () => {
    const set = [inv('Rent', '05/03/2026', 100), inv('Rent', '05/04/2026', 110), inv('Rent', '05/05/2026', 55)];
    expect(describeCompare(buildKpis(set, "2026-04")!.cards[0].compare).text).toBe('▲ +10,00\u00a0zł · +10,0\u00a0%');
    expect(describeCompare(buildKpis(set, '2026-05')!.cards[0].compare)).toMatchObject({ text: '▼ \u221255,00\u00a0zł · \u221250,0\u00a0%', direction: 'down' });
  });
  it('compares with the previous month that has data, and says which month', () => {
    const k = buildKpis([inv('Rent', '05/01/2026', 100), inv('Rent', '05/04/2026', 150)], '2026-04')!;
    expect(describeCompare(k.cards[0].compare).against).toBe('vs Jan');
    const across = buildKpis([inv('Rent', '05/12/2025', 100), inv('Rent', '05/02/2026', 150)], '2026-02')!;
    expect(describeCompare(across.cards[0].compare).against).toBe('vs Dec 2025');
  });
  it('a month without a utility invoice is "not invoiced", not a drop to zero', () => {
    const set = [inv('Utility', '05/10/2026', 300, [line('Electricity', 300)]), inv('Rent', '05/11/2026', 1000)];
    const k = buildKpis(set, '2026-11')!;
    expect(k.cards[2].value).toBe(0);
    expect(k.cards[2].compare).toEqual({ kind: 'not-invoiced', what: 'utility' });
    expect(describeCompare(k.cards[2].compare).text).toBe('No utility invoice this month');
    expect(k.cards[1].compare).toMatchObject({ kind: 'change', current: 1000, previous: 0 });
  });
  it('year to date compares with the same months last year; partial prior data is said out loud', () => {
    const full = [inv('Rent', '01/01/2025', 100), inv('Rent', '01/02/2025', 100), inv('Rent', '01/01/2026', 120), inv('Rent', '01/02/2026', 120)];
    const k = buildKpis(full, '2026-02')!;
    expect(k.cards[3]).toMatchObject({ value: 240, sub: '2 months' });
    expect(k.cards[3].compare).toEqual({ kind: 'change', current: 240, previous: 200, against: '2025 YTD' });
    const partial = [inv('Rent', '01/02/2025', 100), inv('Rent', '01/01/2026', 120), inv('Rent', '01/02/2026', 120)];
    expect(buildKpis(partial, '2026-02')!.cards[3].compare).toMatchObject({ against: '2025 YTD (1 of 2 months)' });
  });
  it('year to date for January is one month; prior-year months after the selected month are not counted', () => {
    const set = [inv('Rent', '01/01/2025', 100), inv('Rent', '01/06/2025', 999), inv('Rent', '01/01/2026', 130)];
    const k = buildKpis(set, '2026-01')!;
    expect(k.cards[3]).toMatchObject({ value: 130, sub: '1 month' });
    expect(k.cards[3].compare).toMatchObject({ previous: 100 });
  });
  it('invoice counts: singular and plural', () => {
    expect(buildKpis([inv('Rent', '01/01/2026', 1)], '2026-01')!.cards[0].sub).toBe('1 invoice');
    expect(buildKpis([inv('Rent', '01/01/2026', 1), inv('Parking', '02/01/2026', 1)], '2026-01')!.cards[0].sub).toBe('2 invoices');
  });
  it('a month with only an "Other" invoice has data but zero amounts', () => {
    const k = buildKpis([inv('Other', '01/01/2026', 500)], '2026-01')!;
    expect(k.cards[0].value).toBe(0);
    expect(k.cards[0].sub).toBe('1 invoice');
  });
});

describe('this month by item', () => {
  it('splits the utility invoice with the same matchers as the Utilities charts; the rest is "Other utility lines"', () => {
    const b = buildBreakdown([utilityInvoice], '2026-11')!;
    const get = (k: string) => b.rows.find((r) => r.key === k)?.amount;
    expect(get('Cold Water')).toBe(85);
    expect(get('Hot Water')).toBe(52);
    expect(get('Electricity')).toBe(90);
    // 'Central Heating' 200 + 'zaliczka ciepła' 100 + 'heating only' 30; both manual rows are left out
    expect(get('Central Heating')).toBe(330);
    expect(get('Waste Management')).toBe(70);
    // manual rows get their own row, so they are not hidden inside "Other"; "unmatched" is the only other line
    expect(get('Manual')).toBe(152 + 76);
    expect(get('Other')).toBe(999);
    expect(b.total).toBe(b.rows.reduce((s, r) => s + r.amount, 0));
  });
  it('carries Polish invoice wording for utilities', () => {
    const b = buildBreakdown([utilityInvoice], '2026-11')!;
    expect(b.rows.find((r) => r.key === 'Central Heating')!.polish).toBe('Ciepło');
    expect(b.rows.find((r) => r.key === 'Hot Water')!.polish).toBe('Ciepła woda');
    expect(b.rows.find((r) => r.key === 'Rent')?.polish).toBeUndefined();
  });
  it('previous month amounts are the previous month WITH data', () => {
    const set = [inv('Rent', '01/01/2026', 1000), inv('Rent', '01/03/2026', 1100)];
    const b = buildBreakdown(set, '2026-03')!;
    expect(b.previousMonth).toBe('Jan 2026');
    expect(b.rows[0]).toMatchObject({ key: 'Rent', amount: 1100, previous: 1000 });
    expect(buildBreakdown(set, '2026-01')!.rows[0].previous).toBeNull();
  });
  it('flags a manual heating value for the month (N × rate) without changing the amounts', () => {
    const a = buildBreakdown([utilityInvoice], '2026-11')!;
    const b = buildBreakdown([utilityInvoice], '2026-11', { 'Nov 2026': 2 })!;
    expect(b.manual).toEqual({ units: 2, amount: 2 * HEATING_RATE });
    expect(b.rows).toEqual(a.rows);
    expect(buildBreakdown([utilityInvoice], '2026-11', { 'Oct 2026': 2 })!.manual).toBeNull();
    expect(buildBreakdown([utilityInvoice], '2026-11', { 'Nov 2026': 0 })!.manual).toBeNull();
  });
});

describe('latest invoices', () => {
  it('returns the 5 most recent by issue date, newest first', () => {
    const latest = latestInvoices(real);
    expect(latest).toHaveLength(5);
    const dates = latest.map((l) => l.stored.invoice.issueDate.split('/').reverse().join(''));
    expect(dates).toEqual([...dates].sort().reverse());
    const allDates = real.map((r) => r.invoice.issueDate.split('/').reverse().join('')).sort().reverse();
    expect(dates[0]).toBe(allDates[0]);
  });
  it('invoices with an unreadable date go last; fewer than 5 is fine; empty is empty', () => {
    const set = [inv('Rent', 'oops', 1), inv('Rent', '05/03/2026', 2)];
    expect(latestInvoices(set).map((l) => l.stored.invoice.issueDate)).toEqual(['05/03/2026', 'oops']);
    expect(latestInvoices([])).toEqual([]);
  });
  it('a Rent invoice without parking lines is just Rent', () => {
    expect(latestInvoices([inv('Rent', '05/03/2026', 2)])[0].label).toBe('Rent');
  });
});

import { invoiceLink, kpiLink, storeLegacyFilters, LEGACY_FILTERS_KEY } from '../lib/overviewLinks';
import { applyFilters } from '../lib/filters';

describe('card and row links', () => {
  it('Total and Rent + parking → that month; Utilities → Utility + month; YTD → Jan to the month', () => {
    expect(kpiLink('total', '2026-11')).toMatchObject({ href: '/invoices?month=2026-11', filters: { filterMonth: 'Nov 2026', filterType: 'all' } });
    expect(kpiLink('rent-parking', '2026-11').filters).toMatchObject({ filterMonth: 'Nov 2026', filterType: 'all' });
    expect(kpiLink('utility', '2026-11')).toMatchObject({ href: '/invoices?month=2026-11&type=Utility', filters: { filterType: 'Utility', filterMonth: 'Nov 2026' } });
    expect(kpiLink('ytd', '2026-11')).toMatchObject({ href: '/invoices?from=2026-01&to=2026-11', filters: { filterMonth: 'all', dateRangeStart: '2026-01', dateRangeEnd: '2026-11' } });
  });
  it('the stored filters select exactly what the card counts', () => {
    const all = [...real, combinedInvoice, utilityInvoice];
    const month = applyFilters(all, kpiLink('total', '2026-11').filters);
    expect(month.length).toBe(buildKpisCount(all, '2026-11'));
    const utilities = applyFilters(all, kpiLink('utility', '2026-11').filters);
    expect(utilities.every((i) => i.invoice.invoiceType === 'Utility')).toBe(true);
    const ytd = applyFilters(all, kpiLink('ytd', '2026-11').filters);
    expect(ytd.every((i) => i.invoice.issueDate.endsWith('/2026'))).toBe(true);
  });
  it('a row link opens that invoice\'s drawer by id; the id is URL-encoded and no filters are touched', () => {
    const l = invoiceLink(combinedInvoice);
    expect(l.href).toBe(`/invoices?invoice=${encodeURIComponent(combinedInvoice.id)}`);
    expect(l).not.toHaveProperty('filters');
  });
  it('writes the filters under the key the current Invoices page reads, and survives a blocked storage', () => {
    const store: Record<string, string> = {};
    (globalThis as { window?: unknown }).window = { localStorage: { setItem: (k: string, v: string) => (store[k] = v) } };
    storeLegacyFilters(kpiLink('utility', '2026-11').filters);
    expect(JSON.parse(store[LEGACY_FILTERS_KEY])).toMatchObject({ filterType: 'Utility', filterMonth: 'Nov 2026', searchQuery: '' });
    (globalThis as { window?: unknown }).window = { localStorage: { setItem: () => { throw new Error('blocked'); } } };
    expect(() => storeLegacyFilters(kpiLink('total', '2026-11').filters)).not.toThrow();
    delete (globalThis as { window?: unknown }).window;
  });
});

function buildKpisCount(all: StoredInvoice[], ym: string): number {
  return Number(buildKpis(all, ym)!.cards[0].sub.split(' ')[0]);
}

describe('describeCompare parts (where a narrow card may wrap)', () => {
  it('amount and percentage are separate parts, joined they equal the text', () => {
    const d = describeCompare({ kind: 'change', current: 110, previous: 100, against: 'Mar' });
    expect(d.parts).toEqual(['▲ +10,00\u00a0zł', '+10,0\u00a0%']);
    expect(d.parts.join(' · ')).toBe(d.text);
  });
  it('no percentage when the previous value is 0; messages stay in one piece', () => {
    expect(describeCompare({ kind: 'change', current: 50, previous: 0, against: 'Mar' }).parts).toEqual(['▲ +50,00\u00a0zł']);
    expect(describeCompare({ kind: 'not-invoiced', what: 'utility' }).parts).toEqual(['No utility invoice this month']);
    expect(describeCompare({ kind: 'change', current: 5, previous: 5, against: 'Mar' }).parts).toEqual(['— no change']);
  });
});
