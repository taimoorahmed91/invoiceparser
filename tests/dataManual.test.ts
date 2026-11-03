import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import { combinedInvoice, invoice, line } from './fixtures/synthetic';
import { buildManualRows, formatUnits, manualAdjustment, manualChartSpec, manualStatus, manualTableSpec, parseUnits } from '../lib/dataManual';
import { HEATING_RATE } from '../lib/adjustments';
import { cellText, timeSeriesToTable } from '../lib/dataView';
import { fmtMoney } from '../lib/format';

const real = invoicesJson as StoredInvoice[];
const util = (date: string, heating = 500) => invoice([line('Central Heating', heating, 2), line('Electricity', 50)], 'Utility', date);

describe('manual heating values: same key and maths as the old editor', () => {
  // three months, like the acceptance check
  const set = [util('03/09/2026'), util('03/10/2026'), util('03/11/2026')];
  const values = { 'Sep 2026': 1.43, 'Oct 2026': 2, 'Nov 2026': 0.5 };

  it('the rate is the legacy constant 76 and the adjustment is units × 76 (not rounded)', () => {
    expect(HEATING_RATE).toBe(76);
    expect(manualAdjustment(1.43)).toBe(1.43 * 76);
  });

  it('for 3 months the adjustment equals the "Manual Heating Calculation" line the legacy code adds to that month\'s invoice', () => {
    const rows = buildManualRows(set, values);
    const adjusted = legacy.applyManualAdjustments(set, values);
    for (const r of rows) {
      const inv = adjusted.find((a) => legacy.getMonthYearFromDate(a.invoice.issueDate) === r.month)!;
      const manual = inv.invoice.lineItems.find((l) => /manual heating calculation/i.test(l.description))!;
      expect(manual.grossValue).toBe(r.adjustment);
      expect(manual.description).toBe(`Manual Heating Calculation (${values[r.month as keyof typeof values]} × 76)`);
    }
  });

  it('the old editor text "Current: N × 76 = X" has the same X as the Adjustment column', () => {
    for (const r of buildManualRows(set, values)) {
      const oldText = (values[r.month as keyof typeof values] * 76).toFixed(2);
      expect(r.adjustment.toFixed(2)).toBe(oldText);
      expect(cellText(manualTableSpec([r]).columns[2], manualTableSpec([r]).rows[0])).toBe(fmtMoney(parseFloat(oldText)));
    }
  });

  it('keys are the month key of the invoice issue date, "Mon YYYY" (the primary key of manual values)', () => {
    expect(buildManualRows(set, values).map((r) => r.month)).toEqual(['Nov 2026', 'Oct 2026', 'Sep 2026']);
  });
});

describe('which months are listed', () => {
  it('every month that has a Utility invoice, newest first; Rent and Parking invoices do not add rows', () => {
    const rows = buildManualRows([...real, combinedInvoice], {});
    const utilityMonths = new Set(real.filter((i) => i.invoice.invoiceType === 'Utility').map((i) => legacy.getMonthYearFromDate(i.invoice.issueDate)));
    expect(rows.map((r) => r.month).sort()).toEqual(Array.from(utilityMonths).sort());
    expect(rows.every((r) => r.hasInvoice && r.units === 0)).toBe(true);
    const yms = rows.map((r) => r.ym);
    expect(yms).toEqual([...yms].sort().reverse());
    expect(rows.map((r) => r.month)).not.toContain('Nov 2026'); // that month only has the combined Rent invoice
  });

  it('a stored value for a month without a Utility invoice stays visible and is flagged', () => {
    const rows = buildManualRows([util('03/10/2026')], { 'Oct 2026': 1, 'Aug 2026': 2, 'Jul 2026': 0, 'Unknown': 4 });
    expect(rows.map((r) => [r.month, r.units, r.hasInvoice])).toEqual([['Oct 2026', 1, true], ['Aug 2026', 2, false]]);
    expect(manualStatus(rows[1])).toBe('Saved · no utility invoice this month');
  });

  it('no invoices → no rows; negative and NaN stored values count as no value', () => {
    expect(buildManualRows([], {})).toEqual([]);
    const rows = buildManualRows([util('03/10/2026')], { 'Oct 2026': -3 });
    expect(rows[0].units).toBe(0);
    expect(manualStatus(rows[0])).toBe('Not set');
  });
});

describe('parseUnits', () => {
  it.each([['1,43', 1.43], ['1.43', 1.43], [' 2 ', 2], ['0', 0], ['', 0], ['   ', 0], ['.5', 0.5], ['3,', 3], ['100000', 100000]])('%j → %d', (t, v) => {
    expect(parseUnits(t)).toEqual({ ok: true, value: v });
  });
  it.each(['abc', '1,2,3', '1e3', '--1', '1 000', '€5', 'NaN', '∞'])('%j is an inline error, not a silent 0', (t) => {
    const r = parseUnits(t);
    expect(r.ok).toBe(false);
  });
  it('says why', () => {
    expect(parseUnits('-2')).toEqual({ ok: false, error: 'Units can’t be negative' });
    expect(parseUnits('x')).toMatchObject({ ok: false, error: 'Enter a number, for example 1,43' });
    expect(parseUnits('100001')).toMatchObject({ ok: false });
  });
  it('formatUnits is the inverse for what the box shows', () => {
    expect(formatUnits(1.43)).toBe('1,43');
    expect(formatUnits(0)).toBe('');
    expect(parseUnits(formatUnits(1.4321))).toEqual({ ok: true, value: 1.4321 });
  });
});

describe('table and chart specs', () => {
  const rows = buildManualRows([util('03/09/2026'), util('03/10/2026'), util('03/11/2026'), util('03/12/2026')], { 'Oct 2026': 2, 'Dec 2026': 1.5 });
  it('table: Month · Units · Adjustment (× 76) · Status; CSV text shows numbers, dashes for unset months', () => {
    const t = manualTableSpec(rows);
    expect(t.columns.map((c) => c.label)).toEqual(['Month', 'Units', 'Adjustment (× 76)', 'Status']);
    const text = t.rows.map((r) => t.columns.map((c) => cellText(c, r)));
    expect(text[0]).toEqual(['Dec 2026', '1,5', fmtMoney(114), 'Saved']);
    expect(text[1]).toEqual(['Nov 2026', '—', '—', 'Not set']);
    expect(text[2]).toEqual(['Oct 2026', '2', fmtMoney(152), 'Saved']);
  });
  it('chart: units per month, oldest first, months without a value are gaps (not zeros); never stacked', () => {
    const c = manualChartSpec(rows);
    expect(c.rows.map((r) => [r.month, r.units])).toEqual([['Sep 2026', null], ['Oct 2026', 2], ['Nov 2026', null], ['Dec 2026', 1.5]]);
    expect(c.rows.map((r) => r.__empty)).toEqual([1, 0, 1, 0]);
    expect(c.stackable).toBe(false);
    expect(timeSeriesToTable(c).rows).toHaveLength(4);
  });
});
