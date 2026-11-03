import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import * as legacy from './legacy-reference';
import { combinedInvoice, manualCases, utilityInvoice } from './fixtures/synthetic';
import { buildExport, exportFileName, EXPORT_OPTIONS } from '../lib/dataExport';
import { planImport } from '../lib/importPlan';

const real = invoicesJson as StoredInvoice[];
const sets: [string, StoredInvoice[], Record<string, number>][] = [
  ['fixture, no manual values', real, {}],
  ['fixture with manual values for 3 months', real, { 'Mar 2025': 1.13, 'Sep 2025': 1.84, 'Nov 2025': 1.81 }],
  ['combined invoice + utility invoice', [combinedInvoice, utilityInvoice], { 'Nov 2026': 2 }],
  ['empty', [], {}],
  ...manualCases.map((c): [string, StoredInvoice[], Record<string, number>] => [`manual case: ${c.name}`, [c.stored], c.values]),
];
const day = new Date('2026-11-03T22:30:00Z');

describe.each(sets)('Export (all) — %s — equals the Phase-0 golden strings', (_n, invoices, values) => {
  const old = legacy.applyManualAdjustments(invoices, values);
  it('JSON', () => expect(buildExport('json', invoices, values, day).content).toBe(legacy.toJson(old)));
  it('CSV (with BOM)', () => {
    const f = buildExport('csv', invoices, values, day);
    expect(f.content).toBe(legacy.csvContent(old));
    expect(f.content.charCodeAt(0)).toBe(0xfeff);
  });
  it('Excel-compatible', () => expect(buildExport('xls', invoices, values, day).content).toBe(legacy.excelContent(old)));
});

describe('file names and types match the old handlers', () => {
  it('invoices-YYYY-MM-DD.ext (UTC date, like toISOString().split("T")[0])', () => {
    expect(exportFileName('json', day)).toBe('invoices-2026-11-03.json');
    expect(exportFileName('csv', day)).toBe('invoices-2026-11-03.csv');
    expect(exportFileName('xls', day)).toBe('invoices-2026-11-03.xls');
    expect(exportFileName('csv', new Date('2026-01-01T00:00:00Z'))).toBe('invoices-2026-01-01.csv');
  });
  it('MIME types', () => {
    expect(buildExport('json', [], {}, day).mime).toBe('application/json');
    expect(buildExport('csv', [], {}, day).mime).toBe('text/csv;charset=utf-8;');
    expect(buildExport('xls', [], {}, day).mime).toBe('application/vnd.ms-excel;charset=utf-8;');
  });
  it('three options are offered, in the plan order, with plain labels', () => {
    expect(EXPORT_OPTIONS.map((o) => o.label)).toEqual(['JSON', 'CSV', 'Excel-compatible (.xls)']);
  });
});

describe('export → import round trip', () => {
  it('the JSON export, imported into an empty list, brings every invoice back unchanged (adjustments off)', () => {
    const file = buildExport('json', real, {}, day).content;
    const plan = planImport(file, [], () => 'x');
    expect(plan.ok && plan.fresh.length).toBe(real.length);
    expect(plan.ok && plan.fresh.map((r) => r.invoice)).toEqual(real.map((r) => r.invoice));
  });
});
