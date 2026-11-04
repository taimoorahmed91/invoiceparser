'use client';

import { createContext, createElement, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import * as storage from '../lib/storage';
import type { StoredInvoice } from '../lib/storage';

export interface InvoiceState {
  status: 'loading' | 'ready' | 'error';
  invoices: StoredInvoice[];
  error: string | null;
  undoStack: StoredInvoice[][];
  pending: number;
  /** When the list was last read from the database (ms since epoch); null before the first successful load. */
  loadedAt: number | null;
}
export const initialInvoiceState: InvoiceState = { status: 'loading', invoices: [], error: null, undoStack: [], pending: 0, loadedAt: null };
export type InvoiceAction =
  | { type: 'patch'; patch: Partial<InvoiceState> }
  | { type: 'checkpoint'; invoices: StoredInvoice[] }
  | { type: 'pending'; delta: number };
export function invoiceReducer(state: InvoiceState, action: InvoiceAction): InvoiceState {
  if (action.type === 'checkpoint') return { ...state, invoices: action.invoices, undoStack: [[...state.invoices], ...state.undoStack.slice(0, 9)] };
  if (action.type === 'pending') return { ...state, pending: state.pending + action.delta };
  return { ...state, ...action.patch };
}

/**
 * Merge saved rows into the list WITHOUT creating duplicates (P21): a row whose id is already there replaces it in place,
 * the others are added at the top in the order given. Rows repeated inside `rows` collapse to the last one.
 */
export function mergeById(current: StoredInvoice[], rows: StoredInvoice[]): StoredInvoice[] {
  const incoming = new Map(rows.map(row => [row.id, row]));
  const known = new Set(current.map(row => row.id));
  const added: StoredInvoice[] = [];
  const addedIds = new Set<string>();
  rows.forEach(row => {
    if (known.has(row.id) || addedIds.has(row.id)) return;
    addedIds.add(row.id);
    added.push(incoming.get(row.id)!);
  });
  return [...added, ...current.map(row => incoming.get(row.id) ?? row)];
}

// The provider and tests use the same commands; storage remains the only persistence layer.
export function createInvoiceActions(get: () => InvoiceState, dispatch: (action: InvoiceAction) => void, api = storage) {
  async function mutation<T>(run: () => Promise<T>): Promise<T> {
    dispatch({ type: 'pending', delta: 1 });
    try {
      const result = await run();
      dispatch({ type: 'patch', patch: { error: null } });
      return result;
    } catch (error) {
      dispatch({ type: 'patch', patch: { error: error instanceof Error ? error.message : String(error) } });
      throw error;
    } finally { dispatch({ type: 'pending', delta: -1 }); }
  }
  async function prepend(rows: StoredInvoice[]) {
    return mutation(async () => {
      for (const row of rows) await api.addInvoice(row.filename, row.invoice, row.id);
      dispatch({ type: 'patch', patch: { invoices: [...rows, ...get().invoices] } });
    });
  }
  /**
   * Data → Import (after the preview): saves each row (new ones, and existing ones under their own id) one after another,
   * then updates the list in one step. If a save fails, the list is left as it was.
   */
  async function importRows(rows: StoredInvoice[]) {
    return mutation(async () => {
      for (const row of rows) await api.addInvoice(row.filename, row.invoice, row.id);
      dispatch({ type: 'patch', patch: { invoices: mergeById(get().invoices, rows) } });
    });
  }
  return {
    async reload() {
      dispatch({ type: 'patch', patch: { status: 'loading', error: null } });
      try {
        const invoices = await api.loadInvoices();
        // [] is a successful completion: storage swallows its own network errors.
        dispatch({ type: 'patch', patch: { invoices, status: 'ready', loadedAt: Date.now() } });
      } catch (error) {
        console.error('Failed to load invoices from Supabase:', error);
        dispatch({ type: 'patch', patch: { invoices: [], status: 'error', error: String(error) } });
      }
    },
    addMany: prepend,
    /** Old toolbar import: same file format and count as before, but a row that is already in the list is updated, not shown twice. */
    async importMany(json: string) {
      const rows = api.importFromJson(json);
      await importRows(rows);
      return rows.length;
    },
    importRows,
    async update(row: StoredInvoice) {
      return mutation(async () => {
        await api.addInvoice(row.filename, row.invoice, row.id);
        dispatch({ type: 'patch', patch: { invoices: get().invoices.map(old => old.id === row.id ? row : old) } });
      });
    },
    async remove(id: string) {
      const previous = get().invoices;
      dispatch({ type: 'checkpoint', invoices: previous.filter(row => row.id !== id) });
      return mutation(async () => {
        try { await api.deleteInvoice(id); }
        catch (error) {
          dispatch({ type: 'patch', patch: { invoices: previous } });
          throw error;
        }
      });
    },
    async removeAll() {
      const previous = get().invoices;
      dispatch({ type: 'checkpoint', invoices: [] });
      return mutation(async () => {
        try { await api.clearAllInvoices(); }
        catch (error) {
          dispatch({ type: 'patch', patch: { invoices: previous } });
          throw error;
        }
      });
    },
    async undo(keyboard = false) {
      const { undoStack } = get();
      if (!undoStack.length) return false;
      const previous = undoStack[0];
      dispatch({ type: 'patch', patch: { invoices: previous } });
      // The old keyboard shortcut popped immediately; toolbar undo waits for save.
      if (keyboard) dispatch({ type: 'patch', patch: { undoStack: undoStack.slice(1) } });
      await mutation(async () => {
        await api.saveInvoices(previous);
        if (!keyboard) dispatch({ type: 'patch', patch: { undoStack: get().undoStack.slice(1) } });
      });
      return true;
    },
  };
}

type InvoiceContextValue = InvoiceState & ReturnType<typeof createInvoiceActions> & { canUndo: boolean; syncStatus: 'saving' | 'error' | 'idle' };
const Context = createContext<InvoiceContextValue | null>(null);
export function InvoicesProvider({ children }: { children: ReactNode }) {
  const [state, reactDispatch] = useReducer(invoiceReducer, initialInvoiceState);
  const current = useRef(state);
  const actionRef = useRef<ReturnType<typeof createInvoiceActions> | null>(null);
  if (!actionRef.current) actionRef.current = createInvoiceActions(
    () => current.current,
    action => { current.current = invoiceReducer(current.current, action); reactDispatch(action); },
  );
  const actions = actionRef.current;
  useEffect(() => { void actions.reload(); }, [actions]);
  return createElement(Context.Provider, { value: { ...state, ...actions, canUndo: state.undoStack.length > 0, syncStatus: state.pending ? 'saving' : state.error ? 'error' : 'idle' } }, children);
}
export function useInvoices() {
  const value = useContext(Context);
  if (!value) throw new Error('useInvoices requires InvoicesProvider');
  return value;
}
