import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../lib/storage', () => ({
  loadInvoices: vi.fn(), addInvoice: vi.fn(), deleteInvoice: vi.fn(), clearAllInvoices: vi.fn(),
  saveInvoices: vi.fn(), importFromJson: vi.fn(), generateId: vi.fn(),
  loadManualValues: vi.fn(), saveManualValues: vi.fn(),
}));
import * as storage from '../lib/storage';
import { createInvoiceActions, initialInvoiceState, invoiceReducer, mergeById, type InvoiceState } from '../hooks/useInvoices';
import { createManualActions, initialManualState, manualReducer } from '../hooks/useManualValues';
import { combinedInvoice, utilityInvoice } from './fixtures/synthetic';

const rows = [combinedInvoice, { ...utilityInvoice, id: 'utility' }];
function harness(initial: Partial<InvoiceState> = {}) {
  let state = { ...initialInvoiceState, invoices: rows, ...initial };
  const actions = createInvoiceActions(() => state, action => { state = invoiceReducer(state, action); });
  return { actions, get: () => state };
}
beforeEach(() => { vi.resetAllMocks(); });

describe('invoice provider commands with mocked storage', () => {
  it('loads once per reload, honestly treats [] as ready, and exposes loading', async () => {
    const h = harness();
    vi.mocked(storage.loadInvoices).mockResolvedValue([]);
    const request = h.actions.reload();
    expect(h.get().status).toBe('loading');
    await request;
    expect(h.get()).toMatchObject({ status: 'ready', invoices: [], error: null });
    expect(storage.loadInvoices).toHaveBeenCalledTimes(1);
  });
  it('catches an actually rejected load without guessing from an empty result', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(storage.loadInvoices).mockRejectedValue(new Error('offline'));
    const h = harness();
    await h.actions.reload();
    expect(h.get()).toMatchObject({ status: 'error', invoices: [] });
    vi.restoreAllMocks();
  });
  it('optimistically deletes, then undo saves the exact previous snapshot', async () => {
    const h = harness();
    vi.mocked(storage.deleteInvoice).mockImplementation(async () => {
      expect(h.get().invoices).toEqual([rows[1]]);
      expect(h.get().pending).toBe(1);
    });
    await h.actions.remove(rows[0].id);
    expect(storage.deleteInvoice).toHaveBeenCalledWith(rows[0].id);
    await h.actions.undo();
    expect(storage.saveInvoices).toHaveBeenCalledWith(rows);
    expect(h.get().invoices).toEqual(rows);
    expect(h.get().undoStack).toEqual([]);
    expect(h.get().pending).toBe(0);
    expect(vi.mocked(storage.deleteInvoice).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(storage.saveInvoices).mock.invocationCallOrder[0]);
  });
  it.each(['remove', 'removeAll'] as const)('rolls back failed %s but retains the legacy undo checkpoint', async method => {
    vi.mocked(storage.deleteInvoice).mockRejectedValue(new Error('failed'));
    vi.mocked(storage.clearAllInvoices).mockRejectedValue(new Error('failed'));
    const h = harness();
    await expect(method === 'remove' ? h.actions.remove(rows[0].id) : h.actions.removeAll()).rejects.toThrow('failed');
    expect(h.get().invoices).toEqual(rows);
    expect(h.get().undoStack).toEqual([rows]);
    expect(h.get().error).toBe('failed');
    expect(h.get().pending).toBe(0);
  });
  it('clears optimistically with clearAllInvoices and no per-invoice deletes', async () => {
    const h = harness();
    vi.mocked(storage.clearAllInvoices).mockImplementation(async () => { expect(h.get().invoices).toEqual([]); });
    await h.actions.removeAll();
    expect(storage.clearAllInvoices).toHaveBeenCalledOnce();
    expect(storage.deleteInvoice).not.toHaveBeenCalled();
  });
  it('caps the undo history at ten snapshots', async () => {
    const h = harness();
    for (let i = 0; i < 12; i++) await h.actions.removeAll();
    expect(h.get().undoStack).toHaveLength(10);
  });
  it('keeps state on failed toolbar undo and only pops after success', async () => {
    const h = harness({ invoices: [], undoStack: [rows] });
    vi.mocked(storage.saveInvoices).mockRejectedValue(new Error('failed'));
    await expect(h.actions.undo()).rejects.toThrow();
    expect(h.get().invoices).toEqual(rows);
    expect(h.get().undoStack).toEqual([rows]);
  });
  it('preserves the immediate keyboard undo pop, including failure', async () => {
    const h = harness({ invoices: [], undoStack: [rows] });
    vi.mocked(storage.saveInvoices).mockRejectedValue(new Error('failed'));
    const request = h.actions.undo(true);
    expect(h.get().undoStack).toEqual([]);
    await expect(request).rejects.toThrow();
  });
  it('empty undo performs no persistence', async () => {
    expect(await harness().actions.undo()).toBe(false);
    expect(storage.saveInvoices).not.toHaveBeenCalled();
  });
  it('edits by addInvoice(filename, invoice, id), then updates local state', async () => {
    const h = harness();
    const updated = { ...rows[0], filename: 'edited.pdf' };
    vi.mocked(storage.addInvoice).mockImplementation(async () => {
      expect(h.get().invoices).toEqual(rows);
      return updated;
    });
    await h.actions.update(updated);
    expect(storage.addInvoice).toHaveBeenCalledWith(updated.filename, updated.invoice, updated.id);
    expect(h.get().invoices).toEqual([updated, rows[1]]);
  });
  it('failed edit leaves local data unchanged', async () => {
    const h = harness();
    vi.mocked(storage.addInvoice).mockRejectedValue(new Error('failed'));
    await expect(h.actions.update({ ...rows[0], filename: 'changed' })).rejects.toThrow();
    expect(h.get().invoices).toEqual(rows);
  });
  it('add saves each row sequentially then prepends in original order', async () => {
    const h = harness();
    vi.mocked(storage.addInvoice).mockImplementation(async () => {
      expect(h.get().invoices).toEqual(rows);
      return rows[0];
    });
    await h.actions.addMany(rows);
    expect(storage.addInvoice).toHaveBeenNthCalledWith(1, rows[0].filename, rows[0].invoice, rows[0].id);
    expect(storage.addInvoice).toHaveBeenNthCalledWith(2, rows[1].filename, rows[1].invoice, rows[1].id);
    expect(h.get().invoices).toEqual([...rows, ...rows]);
  });
  it('import saves each row sequentially and returns the count, but never shows a row twice (P21 fixed)', async () => {
    const h = harness();
    vi.mocked(storage.importFromJson).mockReturnValue(rows);
    vi.mocked(storage.addInvoice).mockImplementation(async () => {
      expect(h.get().invoices).toEqual(rows);
      return rows[0];
    });
    expect(await h.actions.importMany('json')).toBe(2);
    expect(storage.addInvoice).toHaveBeenNthCalledWith(1, rows[0].filename, rows[0].invoice, rows[0].id);
    expect(storage.addInvoice).toHaveBeenNthCalledWith(2, rows[1].filename, rows[1].invoice, rows[1].id);
    expect(h.get().invoices).toEqual(rows);
    expect(new Set(h.get().invoices.map(r => r.id)).size).toBe(h.get().invoices.length);
  });
  it('importing the same file twice leaves one row per id', async () => {
    const h = harness({ invoices: [] });
    await h.actions.importRows(rows);
    await h.actions.importRows(rows);
    expect(h.get().invoices).toEqual(rows);
  });
  it('importRows: new rows go on top in file order, rows already there are replaced in place', async () => {
    const h = harness();
    const fresh = { ...rows[0], id: 'brand-new', filename: 'new.pdf' };
    const changed = { ...rows[1], filename: 'replaced.pdf' };
    await h.actions.importRows([fresh, changed]);
    expect(h.get().invoices).toEqual([fresh, rows[0], changed]);
    expect(storage.addInvoice).toHaveBeenCalledWith('replaced.pdf', changed.invoice, changed.id);
  });
  it('importRows: a failed save leaves the list untouched and rejects', async () => {
    const h = harness();
    vi.mocked(storage.addInvoice).mockResolvedValueOnce(rows[0]).mockRejectedValueOnce(new Error('second'));
    await expect(h.actions.importRows([{ ...rows[0], id: 'a' }, { ...rows[1], id: 'b' }])).rejects.toThrow('second');
    expect(h.get().invoices).toEqual(rows);
    expect(h.get().pending).toBe(0);
  });
  it('mergeById collapses a row repeated inside the batch to the last version, keeping its first position', () => {
    const a = { ...rows[0], id: 'x', filename: '1' };
    const b = { ...rows[0], id: 'y', filename: '2' };
    const a2 = { ...rows[0], id: 'x', filename: '3' };
    expect(mergeById([], [a, b, a2]).map(r => [r.id, r.filename])).toEqual([['x', '3'], ['y', '2']]);
  });
  it('records when the list was last read from the database', async () => {
    const h = harness();
    expect(h.get().loadedAt).toBeNull();
    vi.mocked(storage.loadInvoices).mockResolvedValue(rows);
    const before = Date.now();
    await h.actions.reload();
    expect(h.get().loadedAt).toBeGreaterThanOrEqual(before);
    vi.mocked(storage.loadInvoices).mockRejectedValue(new Error('down'));
    const kept = h.get().loadedAt;
    await h.actions.reload();
    expect(h.get().status).toBe('error');
    expect(h.get().loadedAt).toBe(kept);
  });
  it('partial upload failure never prepends a partially saved batch', async () => {
    const h = harness();
    vi.mocked(storage.addInvoice).mockResolvedValueOnce(rows[0]).mockRejectedValueOnce(new Error('second'));
    await expect(h.actions.addMany(rows)).rejects.toThrow('second');
    expect(h.get().invoices).toEqual(rows);
  });
  it('deduplicates uploads against existing data and within the batch by number-date', () => {
    const h = harness({ invoices: [rows[0]] });
    vi.mocked(storage.generateId).mockReturnValue('new-id');
    const prepared = h.actions.prepareUpload([
      { filename: 'existing', invoice: rows[0].invoice },
      { filename: 'new', invoice: { ...rows[1].invoice, invoiceNumber: 'NEW' } },
      { filename: 'repeat', invoice: { ...rows[1].invoice, invoiceNumber: 'NEW' } },
    ]);
    expect(prepared.duplicates).toEqual(['existing', 'repeat']);
    expect(prepared.rows).toHaveLength(1);
    expect(prepared.rows[0]).toMatchObject({ id: 'new-id', filename: 'new' });
    expect(storage.addInvoice).not.toHaveBeenCalled();
  });
});

describe('manual values provider commands', () => {
  function manualHarness() {
    let state = initialManualState;
    const actions = createManualActions(() => state, patch => { state = manualReducer(state, patch); });
    return { actions, get: () => state };
  }
  it('loads month-keyed values and saves optimistic values, then re-syncs', async () => {
    vi.mocked(storage.loadManualValues).mockResolvedValue({ 'Nov 2026': 1 });
    const h = manualHarness();
    await h.actions.reload();
    expect(h.get()).toMatchObject({ status: 'ready', values: { 'Nov 2026': 1 } });
    const request = h.actions.setValue('Nov 2026', 2);
    expect(h.get().values).toEqual({ 'Nov 2026': 2 });
    await request;
    await h.actions.saveAll();
    expect(storage.saveManualValues).toHaveBeenNthCalledWith(1, { 'Nov 2026': 2 });
    expect(storage.saveManualValues).toHaveBeenNthCalledWith(2, { 'Nov 2026': 2 });
    expect(h.get().pending).toBe(0);
  });
  it('retains the optimistic value on save failure and exposes sync error', async () => {
    vi.mocked(storage.saveManualValues).mockRejectedValue(new Error('offline'));
    const h = manualHarness();
    await expect(h.actions.setValue('Nov 2026', 3)).rejects.toThrow('offline');
    expect(h.get().values).toEqual({ 'Nov 2026': 3 });
    expect(h.get().error).toContain('offline');
    expect(h.get().pending).toBe(0);
  });
});
