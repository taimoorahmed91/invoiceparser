import { describe, it, expect } from 'vitest';
import {
  populatedPoints, chartKindOptions, resolveChartType, chartTypeFromKind, chartTypeKind, isStackedType,
  timeSeriesToTable, cellText, slugify, exportFilename, MIN_POINTS_FOR_LINE, type TimeSeriesSpec,
} from '../lib/dataView';
import { parseChartPrefs, updateChartPref, clearedChartPrefs } from '../lib/chartPrefs';

const mk = (rows: number, opts: Partial<TimeSeriesSpec> = {}): TimeSeriesSpec => ({
  xKey: 'month', xLabel: 'Month',
  series: [{ key: 'Rent', label: 'Rent', color: 'var(--rent)' }, { key: 'Utility', label: 'Utility', color: 'var(--utility)' }],
  rows: Array.from({ length: rows }, (_, i) => ({ month: `M${i}`, Rent: 100 + i, Utility: 10 })),
  allowArea: true, showTotal: true, ...opts,
});

describe('populatedPoints', () => {
  it('counts real observations, not padded empty slots', () => {
    const spec = mk(3);
    spec.rows.push({ month: 'pad1', Rent: 0, Utility: 0 }, { month: 'pad2', Rent: null, Utility: null });
    expect(populatedPoints(spec)).toBe(3);
  });
  it('a row counts when any series has data', () => {
    expect(populatedPoints({ series: mk(1).series, rows: [{ month: 'a', Rent: 0, Utility: 5 }] })).toBe(1);
  });
});

describe('≥ 4-point rule', () => {
  it('Bar is always available; Line and Area are disabled below 4 populated points, with the plan text', () => {
    const o = chartKindOptions(mk(3));
    expect(o.map((x) => x.kind)).toEqual(['bar', 'line', 'area']);
    expect(o[0].disabledReason).toBeUndefined();
    expect(o[1].disabledReason).toBe('Line needs at least 4 months with data — you have 3. Showing as bars instead.');
    expect(o[2].disabledReason).toContain('Area needs at least 4 months with data — you have 3.');
  });
  it('exactly 4 points enables them', () => {
    expect(MIN_POINTS_FOR_LINE).toBe(4);
    expect(chartKindOptions(mk(4)).every((x) => !x.disabledReason)).toBe(true);
  });
  it('padded empty months do not unlock Line', () => {
    const s = mk(3);
    for (let i = 0; i < 5; i++) s.rows.push({ month: `p${i}`, Rent: 0, Utility: 0 });
    expect(chartKindOptions(s)[1].disabledReason).toMatch(/you have 3/);
  });
  it('Area is only offered when the data allows it', () => {
    expect(chartKindOptions(mk(6, { allowArea: false })).map((x) => x.kind)).toEqual(['bar', 'line']);
  });
  it('unit word is configurable', () => {
    expect(chartKindOptions(mk(2, { unit: 'years' }))[1].disabledReason).toContain('4 years');
  });
});

describe('remembered type fallback', () => {
  it('keeps a valid remembered choice', () => {
    expect(resolveChartType('line', mk(6))).toBe('line');
    expect(resolveChartType('area', mk(6))).toBe('area');
    expect(resolveChartType('bar-grouped', mk(2))).toBe('bar-grouped');
  });
  it('falls back to Bar (Stacked) when Line/Area became unavailable', () => {
    expect(resolveChartType('line', mk(3))).toBe('bar-stacked');
    expect(resolveChartType('area', mk(3))).toBe('bar-stacked');
    expect(resolveChartType('area', mk(8, { allowArea: false }))).toBe('bar-stacked');
  });
  it('defaults to Bar (Stacked)', () => {
    expect(resolveChartType(undefined, mk(8))).toBe('bar-stacked');
  });
  it('segment ↔ stored type mapping', () => {
    expect(chartTypeFromKind('bar', true)).toBe('bar-stacked');
    expect(chartTypeFromKind('bar', false)).toBe('bar-grouped');
    expect(chartTypeFromKind('line', true)).toBe('line');
    expect(chartTypeKind('area')).toBe('area');
    expect(isStackedType('area')).toBe(true);
    expect(isStackedType('bar-grouped')).toBe(false);
  });
});

describe('table behind a chart', () => {
  it('has x, one column per series and a Total column for stacked data', () => {
    const t = timeSeriesToTable(mk(2, { formatValue: (n) => `${n} zł` }));
    expect(t.columns.map((c) => c.label)).toEqual(['Month', 'Rent', 'Utility', 'Total']);
    expect(t.rows[0].__total).toBe(110);
    expect(cellText(t.columns[3], t.rows[0])).toBe('110 zł');
    expect(cellText(t.columns[1], { month: 'x', Rent: null })).toBe('—');
  });
  it('no Total for a single series', () => {
    const one = mk(2, { series: [mk(1).series[0]] });
    expect(timeSeriesToTable(one).columns.map((c) => c.key)).toEqual(['month', 'Rent']);
  });
});

describe('filenames', () => {
  it('slugifies, including Polish letters', () => {
    expect(slugify('Utilities → Cost → Central Heating')).toBe('utilities-cost-central-heating');
    expect(slugify('Gospodarka odpadami / Łódź')).toBe('gospodarka-odpadami-lodz');
    expect(slugify('???')).toBe('panel');
  });
  it('invoice-parser-{slug}-{yyyy-mm-dd}.{ext}', () => {
    expect(exportFilename('Monthly costs', 'csv', new Date(2026, 10, 3))).toBe('invoice-parser-monthly-costs-2026-11-03.csv');
    expect(exportFilename('X', 'png', new Date(2026, 0, 9))).toBe('invoice-parser-x-2026-01-09.png');
  });
});

describe('chart prefs storage', () => {
  it('round-trips and merges per key', () => {
    let raw = updateChartPref(null, 'a', { view: 'table' });
    raw = updateChartPref(raw, 'a', { chartType: 'line' });
    raw = updateChartPref(raw, 'b', { chartType: 'area' });
    expect(parseChartPrefs(raw)).toEqual({ a: { view: 'table', chartType: 'line' }, b: { chartType: 'area' } });
  });
  it('drops junk and survives corrupt storage', () => {
    expect(parseChartPrefs('nope')).toEqual({});
    expect(parseChartPrefs('{"a":{"view":"pie","chartType":"line"},"b":5}')).toEqual({ a: { chartType: 'line' } });
    expect(parseChartPrefs(clearedChartPrefs())).toEqual({});
  });
});
