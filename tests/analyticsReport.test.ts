import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import { invoice, line } from './fixtures/synthetic';
import { buildAnalyticsReport, type ReportOptions } from '../lib/analyticsReport';
import { buildMonthlyRows } from '../lib/analyticsMonthly';
import { monthlyStackedSpec, utilityAllSpec, utilityCardSpec, monthlySingleSpec } from '../lib/analyticsSpecs';
import { buildUtilityRows } from '../lib/analyticsUtilities';

const real = invoicesJson as StoredInvoice[];
const base: Omit<ReportOptions, 'scope'> = { tab: 'monthly', range: { kind: 'last', months: 12 }, metric: 'cost', yoyType: 'utility' };

describe('Analytics report (PDF)', () => {
  it('nothing to report without invoices', () => {
    expect(buildAnalyticsReport([], { ...base, scope: 'all' })).toBeNull();
  });

  it('This tab → one section with that tab\'s charts and table; title says which tab', () => {
    const r = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'monthly' })!;
    expect(r.title).toBe('Analytics Report · Monthly costs');
    expect(r.sections.map((s) => s.id)).toEqual(['monthly']);
    expect(r.sections[0].charts.map((c) => [c.title, c.chartType, !!c.half])).toEqual([
      ['Monthly costs', 'bar-stacked', false], ['Rent', 'bar-grouped', true], ['Parking', 'bar-grouped', true], ['Utility', 'bar-grouped', true],
    ]);
    expect(r.sections[0].tables[0].table.columns.map((c) => c.label)).toEqual(['Month', 'Rent', 'Parking', 'Utility', 'Total', 'Change vs previous month']);
    expect(r.meta).toMatch(/^Range: [A-Z][a-z]{2} 20\d\d – [A-Z][a-z]{2} 20\d\d {3}·/);
  });

  it('All tabs → Monthly costs, Utilities (Cost), Year over year, in that order, with one cover title', () => {
    const r = buildAnalyticsReport(real, { ...base, scope: 'all', tab: 'yoy', metric: 'usage' })!;
    expect(r.title).toBe('Analytics Report');
    expect(r.sections.map((s) => s.id)).toEqual(['monthly', 'utilities', 'yoy']);
    // "All tabs" always reports Utilities as Cost, even if the screen shows Usage
    expect(r.sections[1].title).toBe('Utilities — Cost');
    expect(r.sections[1].charts.map((c) => c.title)).toEqual(['All utilities', 'Cold Water', 'Hot Water', 'Electricity', 'Central Heating', 'Waste Management']);
    expect(r.sections[1].charts.slice(1).every((c) => c.half)).toBe(true);
    expect(r.meta).toContain('Year over year always uses all years');
  });

  it('utility mini-charts carry the Polish invoice wording (for the diacritics in the PDF)', () => {
    const r = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'utilities' })!;
    const subs = r.sections[0].charts.map((c) => c.subtitle ?? '');
    expect(subs.some((s) => s.includes('Ciepło'))).toBe(true);
    expect(subs.some((s) => s.includes('Ciepła woda'))).toBe(true);
    expect(subs.some((s) => s.includes('Gospodarka odpadami'))).toBe(true);
  });

  it('Usage: four charts, a plain table, and the flat-fee note about Waste Management', () => {
    const r = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'utilities', metric: 'usage' })!;
    expect(r.sections[0].title).toBe('Utilities — Usage');
    expect(r.sections[0].charts.map((c) => c.title)).not.toContain('Waste Management');
    expect(r.sections[0].charts).toHaveLength(4);
    expect(r.sections[0].tables[0].table.columns.map((c) => c.label)).toEqual(['Month', 'Cold Water', 'Hot Water', 'Electricity', 'Central Heating']);
    expect(r.sections[0].note).toMatch(/flat monthly fee/);
  });

  it('Year over year: Line when there are at least 4 months, the plan message when no month has two years', () => {
    // the fixture only has January in two years, and only as rent: Total overlaps, Utility does not
    const utility = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'yoy' })!;
    expect(utility.sections[0].note).toBe('Year-over-year needs the same month in two different years.');
    const r = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'yoy', yoyType: 'total' })!;
    expect(r.sections[0].charts[0].chartType).toBe('line');
    expect(r.sections[0].tables[0].table.columns.at(-1)!.label).toMatch(/^Change 20\d\d vs 20\d\d$/);
    const one = [invoice([line('Rent', 100)], 'Rent', '05/01/2025'), invoice([line('Rent', 100)], 'Rent', '05/02/2026')];
    const none = buildAnalyticsReport(one, { ...base, scope: 'tab', tab: 'yoy' })!;
    expect(none.sections[0].charts).toEqual([]);
    expect(none.sections[0].note).toBe('Year-over-year needs the same month in two different years.');
  });

  it('a range without data gives a note, not an empty chart', () => {
    const r = buildAnalyticsReport(real, { ...base, scope: 'all', range: { kind: 'custom', from: '2001-01', to: '2001-02' } })!;
    expect(r.sections[0].note).toBe('No invoices in this range.');
    expect(r.sections[0].charts).toEqual([]);
    expect(r.sections[1].note).toBe('No utility invoices in this range.');
  });
});

describe('the report uses the same spec builders as the tabs', () => {
  it('numbers are identical to what the cards get', () => {
    const rows = buildMonthlyRows(real, base.range).rows;
    const r = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'monthly' })!;
    expect(r.sections[0].charts[0].spec.rows).toEqual(monthlyStackedSpec(rows).rows);
    expect(r.sections[0].charts[1].spec.rows).toEqual(monthlySingleSpec(rows, 'Rent').rows);
    const u = buildUtilityRows(real, base.range, 'cost');
    const ru = buildAnalyticsReport(real, { ...base, scope: 'tab', tab: 'utilities' })!;
    expect(ru.sections[0].charts[0].spec.rows).toEqual(utilityAllSpec(u.rows).rows);
    expect(ru.sections[0].charts[2].spec.rows).toEqual(utilityCardSpec(u, 'Hot Water', 'cost').rows);
  });
});
