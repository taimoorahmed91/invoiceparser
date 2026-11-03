import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import type { ParsedInvoice } from '../lib/parseInvoice';
import { Uploader, dupKey, failureMessage, liveMessage, summarize, summaryText, type UploaderDeps } from '../lib/uploader';
import type { ParseOutcome } from '../lib/uploadApi';
import { invoice, line } from './fixtures/synthetic';

const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' });
const inv = (num: string, date = '03/11/2026', lines = [line('Rent', 100)]): ParsedInvoice => ({ ...invoice(lines, 'Rent', date).invoice, invoiceNumber: num });
const stored = (num: string, date = '03/11/2026', id = `db_${num}`): StoredInvoice => ({ id, filename: `${num}.pdf`, parsedAt: '2026-01-01T00:00:00Z', invoice: inv(num, date) });

interface Deferred<T> { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void }
const deferred = <T,>(): Deferred<T> => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = (n = 5) => new Promise<void>((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); go(); });

/** A harness: parse results by file name (immediate, delayed or failing), a fake database, counters for overlap. */
function harness(opts: { parse?: Record<string, ParseOutcome | Deferred<ParseOutcome>>; existing?: StoredInvoice[]; saveFails?: Set<string>; saveGate?: Deferred<void> } = {}) {
  const db: StoredInvoice[] = [...(opts.existing ?? [])];
  const log = { parsed: [] as string[], saved: [] as string[], maxReading: 0, reading: 0, maxSaving: 0, saving: 0 };
  let ids = 0;
  const deps: UploaderDeps = {
    parse: async (file) => {
      log.parsed.push(file.name);
      log.reading++; log.maxReading = Math.max(log.maxReading, log.reading);
      try {
        const r = opts.parse?.[file.name];
        if (!r) return { ok: true, invoice: inv(`FA/${file.name}`) };
        return 'promise' in r ? await r.promise : r;
      } finally { log.reading--; }
    },
    stored: () => db,
    save: async (row) => {
      log.saving++; log.maxSaving = Math.max(log.maxSaving, log.saving);
      try {
        if (opts.saveGate) await opts.saveGate.promise;
        await tick(2);
        if (opts.saveFails?.has(row.filename)) throw new Error('database said no');
        db.unshift(row); log.saved.push(row.filename);
      } finally { log.saving--; }
    },
    newId: () => `new_${++ids}`,
    now: () => '2026-11-03T10:00:00.000Z',
  };
  return { up: new Uploader(deps), db, log };
}
const statuses = (up: Uploader) => up.getSnapshot().map((i) => [i.name, i.status]);
const settle = async (up: Uploader) => { for (let i = 0; i < 200 && up.isWorking(); i++) await tick(2); };

describe('every file becomes a row with a status', () => {
  it('a PDF goes waiting → reading → saving → saved; the row written has a new id and the file name', async () => {
    const h = harness();
    const seen: string[] = [];
    h.up.subscribe(() => seen.push(h.up.getSnapshot()[0]?.status));
    h.up.add([pdf('a.pdf')]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['a.pdf', 'saved']]);
    expect(Array.from(new Set(seen))).toEqual(['waiting', 'reading', 'saving', 'saved']);
    expect(h.db[0]).toMatchObject({ id: 'new_1', filename: 'a.pdf', parsedAt: '2026-11-03T10:00:00.000Z' });
  });

  it('a non-PDF is listed as skipped, never sent for reading, and does not stop the others', async () => {
    const h = harness();
    h.up.add([pdf('a.pdf'), new File(['x'], 'notes.txt', { type: 'text/plain' }), new File(['x'], 'photo.png', { type: 'image/png' })]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['a.pdf', 'saved'], ['notes.txt', 'skipped'], ['photo.png', 'skipped']]);
    expect(h.log.parsed).toEqual(['a.pdf']);
  });

  it('a PDF with no type from the system (name ends in .pdf) is accepted', async () => {
    const h = harness();
    h.up.add([new File(['%PDF'], 'scan.PDF', { type: '' })]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['scan.PDF', 'saved']]);
  });

  it('a file the server cannot read is failed at the read step with the reason kept for Details', async () => {
    const h = harness({ parse: { 'broken.pdf': { ok: false, error: 'Failed to parse PDF: Invalid PDF structure' } } });
    h.up.add([pdf('broken.pdf')]);
    await settle(h.up);
    expect(h.up.getSnapshot()[0]).toMatchObject({ status: 'failed', stage: 'read', error: 'Failed to parse PDF: Invalid PDF structure' });
    expect(h.db).toHaveLength(0);
  });

  it('a parse that throws (network) is a failed row, not a crash', async () => {
    const h = harness();
    (h.up as unknown as { deps: UploaderDeps }).deps.parse = async () => { throw new Error('offline'); };
    h.up.add([pdf('a.pdf')]);
    await settle(h.up);
    expect(h.up.getSnapshot()[0]).toMatchObject({ status: 'failed', stage: 'read', error: 'offline' });
  });

  it('a database failure is a failed row at the SAVE step ("Couldn\'t save"), the invoice is kept for retry', async () => {
    const h = harness({ saveFails: new Set(['a.pdf']) });
    h.up.add([pdf('a.pdf')]);
    await settle(h.up);
    const row = h.up.getSnapshot()[0];
    expect(row).toMatchObject({ status: 'failed', stage: 'save', error: 'database said no' });
    expect(row.invoice).toBeDefined();
    expect(row.row?.id).toBe('new_1');
  });
});

describe('duplicates keep the existing key: invoiceNumber + issueDate', () => {
  it('the key is exactly number-date', () => expect(dupKey({ invoiceNumber: 'FA/1', issueDate: '03/11/2026' })).toBe('FA/1-03/11/2026'));

  it('same number and date as a stored invoice → "Already saved", linked to the stored one, nothing written', async () => {
    const h = harness({ existing: [stored('FA/dup.pdf')], parse: {} });
    h.up.add([pdf('dup.pdf')]);
    await settle(h.up);
    const row = h.up.getSnapshot()[0];
    expect(row.status).toBe('duplicate');
    expect(row.duplicateOf).toMatchObject({ id: 'db_FA/dup.pdf', invoiceNumber: 'FA/dup.pdf', where: 'saved' });
    expect(h.log.saved).toEqual([]);
  });

  it('same number on a different date is a different invoice', async () => {
    const h = harness({ existing: [stored('FA/x.pdf', '01/10/2026')], parse: {} });
    h.up.add([pdf('x.pdf')]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['x.pdf', 'saved']]);
  });

  it('the same invoice in two files of one batch: the EARLIER file is saved, the later one is "Already saved" pointing at it', async () => {
    const same = { ok: true as const, invoice: inv('FA/same') };
    const h = harness({ parse: { 'one.pdf': same, 'two.pdf': same } });
    h.up.add([pdf('one.pdf'), pdf('two.pdf')]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['one.pdf', 'saved'], ['two.pdf', 'duplicate']]);
    expect(h.up.getSnapshot()[1].duplicateOf).toMatchObject({ where: 'batch', fileName: 'one.pdf', invoiceNumber: 'FA/same' });
    expect(h.log.saved).toEqual(['one.pdf']);
  });

  it('…even when the later file finishes reading FIRST (decisions follow file order)', async () => {
    const slow = deferred<ParseOutcome>(); const fast = deferred<ParseOutcome>();
    const h = harness({ parse: { 'one.pdf': slow, 'two.pdf': fast } });
    h.up.add([pdf('one.pdf'), pdf('two.pdf')]);
    await tick();
    fast.resolve({ ok: true, invoice: inv('FA/same') });
    await tick();
    expect(statuses(h.up)).toEqual([['one.pdf', 'reading'], ['two.pdf', 'reading']]); // two waits for one
    slow.resolve({ ok: true, invoice: inv('FA/same') });
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['one.pdf', 'saved'], ['two.pdf', 'duplicate']]);
  });

  it('a file that failed to read does not hold up the later ones', async () => {
    const h = harness({ parse: { 'bad.pdf': { ok: false, error: 'x' } } });
    h.up.add([pdf('bad.pdf'), pdf('ok.pdf')]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['bad.pdf', 'failed'], ['ok.pdf', 'saved']]);
  });
});

describe('the stored list must be known before anything is decided', () => {
  it('waits for ready() before checking duplicates, so a drop before the list has loaded cannot create a duplicate', async () => {
    const gate = deferred<void>();
    const h = harness({ existing: [stored('FA/dup.pdf')] });
    (h.up as unknown as { deps: UploaderDeps }).deps.ready = () => gate.promise;
    h.up.add([pdf('dup.pdf')]);
    await tick(10);
    expect(statuses(h.up)).toEqual([['dup.pdf', 'reading']]);
    gate.resolve();
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['dup.pdf', 'duplicate']]);
    expect(h.log.saved).toEqual([]);
  });

  it('when the list could not be loaded the row fails with that reason (nothing is written) and can be retried', async () => {
    let ok = false;
    const h = harness();
    (h.up as unknown as { deps: UploaderDeps }).deps.ready = async () => { if (!ok) throw new Error('Your invoice list could not be loaded.'); };
    h.up.add([pdf('a.pdf')]);
    await settle(h.up);
    expect(h.up.getSnapshot()[0]).toMatchObject({ status: 'failed', stage: 'save', error: 'Your invoice list could not be loaded.' });
    expect(h.db).toHaveLength(0);
    ok = true;
    h.up.retry();
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['a.pdf', 'saved']]);
  });
});

describe('pacing: two reads at a time, one write at a time', () => {
  it('never more than 2 files are read at once, and every file is read', async () => {
    const h = harness();
    h.up.add(Array.from({ length: 7 }, (_, i) => pdf(`f${i}.pdf`)));
    await settle(h.up);
    expect(h.log.maxReading).toBeLessThanOrEqual(2);
    expect(h.log.parsed).toHaveLength(7);
    expect(h.log.saved).toHaveLength(7);
  });

  it('database writes never overlap (sequential, like the old handler)', async () => {
    const h = harness();
    h.up.add(Array.from({ length: 5 }, (_, i) => pdf(`f${i}.pdf`)));
    await settle(h.up);
    expect(h.log.maxSaving).toBe(1);
  });

  it('files dropped while a batch is running join it; after it finished, a new batch replaces the old rows', async () => {
    const gate = deferred<void>();
    const h = harness({ saveGate: gate });
    h.up.add([pdf('a.pdf')]);
    await tick();
    h.up.add([pdf('b.pdf')]);
    expect(h.up.getSnapshot().map((i) => i.name)).toEqual(['a.pdf', 'b.pdf']);
    gate.resolve();
    await settle(h.up);
    h.up.add([pdf('c.pdf')]);
    await settle(h.up);
    expect(h.up.getSnapshot().map((i) => i.name)).toEqual(['c.pdf']);
  });
});

describe('Retry failed re-sends only failures', () => {
  it('retry() touches only failed rows: saved, duplicate and skipped rows are not read or written again', async () => {
    const outcomes: Record<string, ParseOutcome> = { 'bad.pdf': { ok: false, error: 'first time' } };
    const h = harness({ parse: outcomes, existing: [stored('FA/dup.pdf')] });
    h.up.add([pdf('good.pdf'), pdf('bad.pdf'), pdf('dup.pdf'), new File(['x'], 'n.txt', { type: 'text/plain' })]);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['good.pdf', 'saved'], ['bad.pdf', 'failed'], ['dup.pdf', 'duplicate'], ['n.txt', 'skipped']]);
    const parsedBefore = [...h.log.parsed];
    outcomes['bad.pdf'] = { ok: true, invoice: inv('FA/bad') };
    expect(h.up.retry()).toBe(1);
    await settle(h.up);
    expect(statuses(h.up)).toEqual([['good.pdf', 'saved'], ['bad.pdf', 'saved'], ['dup.pdf', 'duplicate'], ['n.txt', 'skipped']]);
    expect(h.log.parsed.slice(parsedBefore.length)).toEqual(['bad.pdf']);
    expect(h.log.saved).toEqual(['good.pdf', 'bad.pdf']);
  });

  it('retry(id) retries just that row', async () => {
    const h = harness({ parse: { 'a.pdf': { ok: false, error: 'x' }, 'b.pdf': { ok: false, error: 'y' } } });
    h.up.add([pdf('a.pdf'), pdf('b.pdf')]);
    await settle(h.up);
    const [a] = h.up.getSnapshot();
    h.up.retry(a.id);
    await settle(h.up);
    expect(h.log.parsed.filter((n) => n === 'a.pdf')).toHaveLength(2);
    expect(h.log.parsed.filter((n) => n === 'b.pdf')).toHaveLength(1);
  });

  it('a failed SAVE is retried with the invoice already read (no second read) and the SAME row id', async () => {
    const fails = new Set(['a.pdf']);
    const h = harness({ saveFails: fails });
    h.up.add([pdf('a.pdf')]);
    await settle(h.up);
    const firstId = h.up.getSnapshot()[0].row!.id;
    fails.clear();
    h.up.retry();
    await settle(h.up);
    expect(h.up.getSnapshot()[0].status).toBe('saved');
    expect(h.log.parsed).toEqual(['a.pdf']);
    expect(h.db[0].id).toBe(firstId);
  });

  it('retry with nothing failed does nothing', async () => {
    const h = harness();
    h.up.add([pdf('a.pdf')]);
    await settle(h.up);
    expect(h.up.retry()).toBe(0);
  });
});

describe('warnings', () => {
  it('a saved invoice that parsed badly keeps its warnings (empty date, Unknown number, zero total, no items)', async () => {
    const bad = inv('Unknown', '', []);
    bad.totals = { netTotal: 0, taxTotal: 0, grossTotal: 0 };
    const h = harness({ parse: { 'weird.pdf': { ok: true, invoice: bad } } });
    h.up.add([pdf('weird.pdf')]);
    await settle(h.up);
    const row = h.up.getSnapshot()[0];
    expect(row.status).toBe('saved');
    expect(row.warnings.map((w) => w.code).sort()).toEqual(['no-date', 'no-items', 'unknown-number', 'zero-total']);
    expect(summarize(h.up.getSnapshot()).needCheck).toBe(1);
  });
});

describe('summary, live message and the failure toast', () => {
  it('summaryText leaves out zero counts', async () => {
    const h = harness({ parse: { 'bad.pdf': { ok: false, error: 'x' } }, existing: [stored('FA/dup.pdf')] });
    h.up.add([pdf('ok.pdf'), pdf('dup.pdf'), pdf('bad.pdf'), new File(['x'], 'n.txt', { type: 'text/plain' })]);
    await settle(h.up);
    expect(summaryText(summarize(h.up.getSnapshot()))).toBe('1 saved · 1 already saved · 1 failed · 1 skipped');
    expect(summaryText(summarize([]))).toBe('Nothing was saved');
  });

  it('live message: quiet while working, the whole summary once everything is done', async () => {
    const gate = deferred<void>();
    const h = harness({ saveGate: gate });
    h.up.add([pdf('a.pdf'), pdf('b.pdf')]);
    await tick();
    expect(liveMessage(h.up.getSnapshot())).toBe('Working on 2 files');
    gate.resolve();
    await settle(h.up);
    expect(liveMessage(h.up.getSnapshot())).toBe('Upload finished: 2 saved');
    expect(liveMessage([])).toBe('');
  });

  it('failure toast: names the files and the step; "and N more" after 3', async () => {
    const bad = (n: string): [string, ParseOutcome] => [n, { ok: false, error: 'x' }];
    const h = harness({ parse: Object.fromEntries([bad('broken.pdf')]) });
    h.up.add([pdf('broken.pdf'), pdf('fine.pdf')]);
    await settle(h.up);
    expect(failureMessage(h.up.getSnapshot())).toBe('1 file couldn’t be read: broken.pdf');
    const many = harness({ parse: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((n) => bad(`${n}.pdf`))) });
    many.up.add(['a', 'b', 'c', 'd', 'e'].map((n) => pdf(`${n}.pdf`)));
    await settle(many.up);
    expect(failureMessage(many.up.getSnapshot())).toBe('5 files couldn’t be read: a.pdf, b.pdf, c.pdf and 2 more');
    const save = harness({ saveFails: new Set(['s.pdf']) });
    save.up.add([pdf('s.pdf')]);
    await settle(save.up);
    expect(failureMessage(save.up.getSnapshot())).toBe('1 file couldn’t be saved: s.pdf');
    const none = harness();
    none.up.add([pdf('ok.pdf')]);
    await settle(none.up);
    expect(failureMessage(none.up.getSnapshot())).toBeNull();
  });
});
