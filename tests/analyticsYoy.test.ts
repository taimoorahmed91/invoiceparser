import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import { combinedInvoice, utilityInvoice, invoice, line } from './fixtures/synthetic';
import { buildYoy, buildYoySpec, parseYoyType, pointsInYear, YOY_META } from '../lib/analyticsYoy';
import { amountsByType } from '../lib/analytics';
import { monthNames } from '../lib/dates';
import { timeSeriesToTable, cellText, chartKindOptions, resolveChartType, populatedPoints } from '../lib/dataView';
import { fmtDelta, fmtMoney } from '../lib/format';

const real = invoicesJson as StoredInvoice[];
const sets: [string, StoredInvoice[]][] = [
  ['empty', []], ['real', real], ['combined', [combinedInvoice]], ['synthetic utilities', [utilityInvoice]],
  ['mixed', [...real, combinedInvoice, utilityInvoice]],
  ['invalid dates', [invoice([], 'Other', ''), invoice([line('Parking', 0)], 'Parking', 'bad'), invoice([], 'Rent', '01/01/2024')]],
];

/** The data of the old "Year-over-Year Comparison (Utility)" chart, copied from the old page. */
function legacyYoyChartData(invoices: StoredInvoice[]) {
  const yearOverYearData = legacy.yoySeries(invoices);
  return monthNames.map((month) => {
    const monthData = yearOverYearData[month] || {};
    const years = Object.keys(monthData).sort();
    const result: Record<string, string | number> = { month };
    years.forEach((year) => {
      result[year] = monthData[year]?.Utility || 0;
    });
    return result;
  }).filter((d) => Object.keys(d).length > 1);
}

describe.each(sets)('%s — year over year', (_n, invoices) => {
  it('Utility series equal the old chart data exactly (golden)', () => {
    expect(buildYoy(invoices, 'utility', { legacyZeros: true }).rows).toEqual(legacyYoyChartData(invoices));
  });
  it('Rent, Parking and Total come from the same split (amountsByType) and add up', () => {
    const byKey = new Map<string, { Rent: number; Parking: number; Utility: number; total: number }>();
    invoices.forEach((inv) => {
      const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(inv.invoice.issueDate);
      if (!m) return;
      const k = `${monthNames[Number(m[2]) - 1]}|${m[3]}`;
      const a = amountsByType(inv.invoice);
      const cur = byKey.get(k) ?? { Rent: 0, Parking: 0, Utility: 0, total: 0 };
      cur.Rent += a.Rent; cur.Parking += a.Parking; cur.Utility += a.Utility; cur.total += a.Rent + a.Parking + a.Utility;
      byKey.set(k, cur);
    });
    const rent = buildYoy(invoices, 'rent'); const parking = buildYoy(invoices, 'parking'); const total = buildYoy(invoices, 'total'); const util = buildYoy(invoices, 'utility');
    byKey.forEach((v, k) => {
      const [month, year] = k.split('|');
      const at = (r: ReturnType<typeof buildYoy>) => (r.rows.find((x) => x.month === month)?.[year] ?? 0) as number; // null = gap = nothing of that type
      expect(at(rent)).toBeCloseTo(v.Rent, 6);
      expect(at(parking)).toBeCloseTo(v.Parking, 6);
      expect(at(util)).toBeCloseTo(v.Utility, 6);
      expect(at(total)).toBeCloseTo(v.total, 6);
      expect(at(total)).toBeCloseTo(at(rent) + at(parking) + at(util), 6);
    });
  });
});

describe('gaps and years', () => {
  const jan25 = invoice([line('Rent', 100)], 'Rent', '05/01/2025');
  const jan26 = invoice([line('Rent', 120)], 'Rent', '05/01/2026');
  const mar26 = invoice([line('Rent', 130)], 'Rent', '05/03/2026');
  const r = buildYoy([jan25, jan26, mar26], 'rent');
  it('always 12 calendar rows; a year without an invoice that month is null, not 0', () => {
    expect(r.rows).toHaveLength(12);
    expect(r.years).toEqual(['2025', '2026']);
    expect(r.rows[0]).toMatchObject({ month: 'Jan', '2025': 100, '2026': 120 });
    expect(r.rows[2]).toMatchObject({ month: 'Mar', '2025': null, '2026': 130 });
    expect(r.rows[5]).toMatchObject({ month: 'Jun', '2025': null, '2026': null });
  });
  it('a month that has invoices but none of the chosen type is a gap, not a 0', () => {
    const rentOnly = invoice([line('Rent', 100)], 'Rent', '05/11/2026');
    const util25 = invoice([line('Cold Water', 40)], 'Utility', '05/11/2025');
    const util = buildYoy([rentOnly, util25], 'utility');
    expect(util.rows[10]).toMatchObject({ month: 'Nov', '2025': 40, '2026': null });
    const rent = buildYoy([rentOnly, util25], 'rent');
    expect(rent.rows[10]).toMatchObject({ '2025': null, '2026': 100 });
    expect(buildYoy([rentOnly, util25], 'total').rows[10]).toMatchObject({ '2025': 40, '2026': 100 });
    expect(util.overlapMonths).toBe(0);
  });
  it('counts months where two years overlap', () => {
    expect(r.overlapMonths).toBe(1);
    expect(buildYoy([jan25, mar26], 'rent').overlapMonths).toBe(0);
    expect(buildYoy([], 'rent')).toEqual({ rows: monthNames.map((month) => ({ month })), years: [], overlapMonths: 0 });
  });
  it('parses the type from the URL', () => {
    expect(parseYoyType('rent')).toBe('rent');
    expect(parseYoyType('total')).toBe('total');
    expect(parseYoyType('x')).toBe('utility');
    expect(parseYoyType(null)).toBe('utility');
  });
});

describe('spec: same hue fading with age, dots for short years, Line by default', () => {
  const mk = (months: number[], year: string) => months.map((m) => invoice([line('Utility', 100 + m)], 'Rent', `05/${String(m).padStart(2, '0')}/${year}`));
  const invoices = [...mk([1, 2, 3, 4, 5, 6], '2024'), ...mk([1, 2, 3, 4, 5, 6, 7], '2025'), ...mk([1, 2, 3], '2026')];
  const spec = buildYoySpec(buildYoy(invoices, 'rent'), 'rent', { value: (n) => fmtMoney(n), delta: (c, p) => fmtDelta(c, p).text });
  it('one series per year, all in the type hue', () => {
    expect(spec.series.map((s) => s.label)).toEqual(['2024', '2025', '2026']);
    expect(spec.series.every((s) => s.color === YOY_META.rent.color)).toBe(true);
  });
  it('newest solid 2.5 px, previous dashed 65 %, two back dotted 40 %', () => {
    const [two, one, now] = spec.series.map((s) => s.style!);
    expect(now).toMatchObject({ width: 2.5, opacity: 1 });
    expect(now.dash).toBeUndefined();
    expect(one).toMatchObject({ dash: '6 4', opacity: 0.65 });
    expect(two).toMatchObject({ dash: '2 4', opacity: 0.4 });
  });
  it('a year with fewer than 4 months shows dots only', () => {
    expect(pointsInYear(spec.rows as never, '2026')).toBe(3);
    expect(spec.series.map((s) => s.style!.pointsOnly)).toEqual([false, false, true]);
  });
  it('opens as Line, never stacked, with a Bar (Grouped) fallback', () => {
    expect(spec.defaultChartType).toBe('line');
    expect(spec.stackable).toBe(false);
    expect(spec.fallbackChartType).toBe('bar-grouped');
    expect(spec.endLabels).toBe(true);
    expect(chartKindOptions(spec).map((o) => o.kind)).toEqual(['bar', 'line']);
    expect(resolveChartType(undefined, spec)).toBe('line');
    expect(resolveChartType('line', spec)).toBe('line');
  });
  it('under 4 populated months overall: Line is disabled and Bar (Grouped) is used', () => {
    const few = buildYoySpec(buildYoy([...mk([1, 2], '2025'), ...mk([1, 2], '2026')], 'rent'), 'rent', { value: String, delta: () => '' });
    expect(populatedPoints(few)).toBe(2);
    expect(chartKindOptions(few)[1].disabledReason).toMatch(/Line needs at least 4 months with data — you have 2/);
    expect(resolveChartType(undefined, few)).toBe('bar-grouped');
  });
  it('table: Month · years · change newest vs previous year (value + %)', () => {
    const t = timeSeriesToTable(spec);
    expect(t.columns.map((c) => c.label)).toEqual(['Month', '2024', '2025', '2026', 'Change 2026 vs 2025']);
    const jan = t.rows[0];
    expect(cellText(t.columns[4], jan)).toBe(fmtDelta(101, 101).text); // equal → "—"
    const mar = t.rows[2];
    expect(mar.__delta).toBe(0);
    const apr = t.rows[3];
    expect(cellText(t.columns[4], apr)).toBe('—'); // 2026 has no April
  });
});
