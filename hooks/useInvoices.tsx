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
}
export const initialInvoiceState: InvoiceState = { status: 'loading', invoices: [], error: null, undoStack: [], pending: 0 };
export type InvoiceAction =
  | { type: 'patch'; patch: Partial<InvoiceState> }
  | { type: 'checkpoint'; invoices: StoredInvoice[] }
  | { type: 'pending'; delta: number };
export function invoiceReducer(state: InvoiceState, action: InvoiceAction): InvoiceState {
  if (action.type === 'checkpoint') return { ...state, invoices: action.invoices, undoStack: [[...state.invoices], ...state.undoStack.slice(0, 9)] };
  if (action.type === 'pending') return { ...state, pending: state.pending + action.delta };
  return { ...state, ...action.patch };
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
  return {
    async reload() {
      dispatch({ type: 'patch', patch: { status: 'loading', error: null } });
      try {
        const invoices = await api.loadInvoices();
        // [] is a successful completion: storage swallows its own network errors.
        dispatch({ type: 'patch', patch: { invoices, status: 'ready' } });
      } catch (error) {
        console.error('Failed to load invoices from Supabase:', error);
        dispatch({ type: 'patch', patch: { invoices: [], status: 'error', error: String(error) } });
      }
    },
    addMany: prepend,
    async importMany(json: string) {
      const rows = api.importFromJson(json);
      await prepend(rows); // Preserve legacy import duplicates in local state.
      return rows.length;
    },
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
    prepareUpload(results: { filename: string; invoice: StoredInvoice['invoice'] }[]) {
      const keys = new Set(get().invoices.map(row => `${row.invoice.invoiceNumber}-${row.invoice.issueDate}`));
      const rows: StoredInvoice[] = [], duplicates: string[] = [];
      results.forEach(result => {
        const key = `${result.invoice.invoiceNumber}-${result.invoice.issueDate}`;
        if (keys.has(key)) duplicates.push(result.filename);
        else {
          rows.push({ ...result, id: api.generateId(), parsedAt: new Date().toISOString() });
          keys.add(key);
        }
      });
      return { rows, duplicates };
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
