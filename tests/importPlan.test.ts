import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import { combinedInvoice, invoice, line } from './fixtures/synthetic';
import { describePlan, looksLikeInvoice, planImport, type ImportPlan } from '../lib/importPlan';
import { toJson } from '../lib/export';

const real = invoicesJson as StoredInvoice[];
let n = 0;
const makeId = () => `gen_${++n}`;
const NOW = '2026-11-03T10:00:00.000Z';
const plan = (rows: unknown, existing: StoredInvoice[]) => planImport(typeof rows === 'string' ? rows : JSON.stringify(rows), existing, makeId, () => NOW) as ImportPlan;
const row = (num: string, date: string, id?: string): StoredInvoice => ({ ...invoice([line('Rent', 100)], 'Rent', date), id: id ?? `id_${num}`, invoice: { ...invoice([line('Rent', 100)], 'Rent', date).invoice, invoiceNumber: num } });

describe('import preview: new vs existing', () => {
  it('an empty list is fine: nothing found', () => {
    const p = plan([], real);
    expect(p).toMatchObject({ ok: true, found: 0, fresh: [], replaceable: [], repeated: 0, unreadable: 0 });
    expect(describePlan(p)).toBe('0 invoices found · 0 already exist · 0 new');
  });

  it('importing the file you just exported: everything already exists, nothing is new', () => {
    const p = plan(toJson(real), real);
    expect(p.found).toBe(real.length);
    expect(p.fresh).toHaveLength(0);
    expect(p.replaceable).toHaveLength(real.length);
    expect(describePlan(p)).toBe(`${real.length} invoices found · ${real.length} already exist · 0 new`);
  });

  it('into an empty list everything is new, and rows keep their id, filename and parsedAt', () => {
    const p = plan(toJson(real), []);
    expect(p.fresh).toHaveLength(real.length);
    expect(p.fresh.map((r) => r.id)).toEqual(real.map((r) => r.id));
    expect(p.fresh[0]).toMatchObject({ filename: real[0].filename, parsedAt: real[0].parsedAt });
  });

  it('the plan\'s example: 26 found · 3 already exist · 23 new', () => {
    const existing = Array.from({ length: 3 }, (_, i) => row(`E${i}`, '01/01/2026'));
    const file = [...existing.map((e) => ({ ...e })), ...Array.from({ length: 23 }, (_, i) => row(`N${i}`, '02/01/2026'))];
    const p = plan(file, existing);
    expect(describePlan(p)).toBe('26 invoices found · 3 already exist · 23 new');
    expect(p.found).toBe(p.fresh.length + p.replaceable.length + p.repeated + p.unreadable);
  });

  it('matches by invoice number + issue date even when the id differs, and then reuses the EXISTING id (no second row)', () => {
    const existing = [row('A/1', '05/03/2026', 'db_id_1')];
    const p = plan([{ ...row('A/1', '05/03/2026', 'file_id_9'), filename: 'from-file.pdf' }], existing);
    expect(p.fresh).toHaveLength(0);
    expect(p.replaceable).toHaveLength(1);
    expect(p.replaceable[0].id).toBe('db_id_1');
    expect(p.replaceable[0].filename).toBe('from-file.pdf');
  });

  it('matches by id even when the number changed', () => {
    const existing = [row('A/1', '05/03/2026', 'same_id')];
    const p = plan([row('A/1-EDITED', '05/03/2026', 'same_id')], existing);
    expect(p.replaceable.map((r) => r.id)).toEqual(['same_id']);
    expect(p.replaceable[0].invoice.invoiceNumber).toBe('A/1-EDITED');
  });

  it('same number on another date is a different invoice', () => {
    const p = plan([row('A/1', '06/03/2026', 'other_id')], [row('A/1', '05/03/2026', 'db_id')]);
    expect(p.fresh).toHaveLength(1);
    expect(p.replaceable).toHaveLength(0);
  });

  it('the same invoice twice inside the file counts once; the repeat is reported, not imported', () => {
    const p = plan([row('B/1', '01/02/2026', 'x1'), row('B/1', '01/02/2026', 'x2'), row('B/2', '01/02/2026', 'x1')], []);
    expect(p.fresh.map((r) => r.id)).toEqual(['x1']);
    expect(p.repeated).toBe(2);
    expect(p.found).toBe(3);
  });

  it('rows without an id get a generated one; missing parsedAt / filename are filled', () => {
    const { id, ...noId } = row('C/1', '01/02/2026');
    const p = plan([{ invoice: noId.invoice }], []);
    expect(p.fresh[0]).toMatchObject({ id: expect.stringMatching(/^gen_/), filename: '', parsedAt: NOW });
    void id;
  });

  it('things that are not invoices are counted as unreadable and never imported', () => {
    const good = row('D/1', '01/02/2026');
    const p = plan([good, null, 'text', 5, [], {}, { invoice: {} }, { invoice: { ...good.invoice, lineItems: 'no' } }, { invoice: { ...good.invoice, totals: { netTotal: 'x' } } }, { invoice: { ...good.invoice, invoiceNumber: '' } }], []);
    expect(p.fresh).toHaveLength(1);
    expect(p.unreadable).toBe(9);
    expect(p.found).toBe(10);
  });

  it('not JSON, or not a list → a plain error, never a throw', () => {
    expect(planImport('{nope', [], makeId)).toMatchObject({ ok: false, error: expect.stringContaining('not valid JSON') });
    expect(planImport('{"a":1}', [], makeId)).toMatchObject({ ok: false, error: expect.stringContaining('list of invoices') });
    expect(planImport('', [], makeId).ok).toBe(false);
  });

  it('the combined rent + parking invoice survives the round trip untouched', () => {
    const p = plan(toJson([combinedInvoice]), []);
    expect(p.fresh[0].invoice).toEqual(combinedInvoice.invoice);
  });

  it('looksLikeInvoice accepts fixture rows', () => {
    expect(real.every(looksLikeInvoice)).toBe(true);
  });

  it('singular grammar', () => {
    const p = plan([row('E/1', '01/02/2026')], [row('E/1', '01/02/2026')]);
    expect(describePlan(p)).toBe('1 invoice found · 1 already exists · 0 new');
  });
});
