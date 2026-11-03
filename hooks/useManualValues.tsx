'use client';

import { createContext, createElement, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import * as storage from '../lib/storage';

export interface ManualState {
  values: Record<string, number>;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  pending: number;
}
export const initialManualState: ManualState = { values: {}, status: 'loading', error: null, pending: 0 };
export function manualReducer(state: ManualState, patch: Partial<ManualState>): ManualState { return { ...state, ...patch }; }
export function createManualActions(get: () => ManualState, dispatch: (patch: Partial<ManualState>) => void, api = storage) {
  async function save(values: Record<string, number>) {
    dispatch({ pending: get().pending + 1 });
    try { await api.saveManualValues(values); dispatch({ error: null }); }
    catch (error) { dispatch({ error: String(error) }); throw error; }
    finally { dispatch({ pending: get().pending - 1 }); }
  }
  return {
    async reload() {
      dispatch({ status: 'loading', error: null });
      try { dispatch({ values: await api.loadManualValues(), status: 'ready' }); }
      catch (error) {
        console.error('Failed to load manual values:', error);
        dispatch({ values: {}, status: 'error', error: String(error) });
      }
    },
    setValue(month: string, value: number) {
      const values = { ...get().values, [month]: value };
      dispatch({ values }); // Legacy manual values are optimistic, with no rollback.
      return save(values);
    },
    saveAll() { return save(get().values); },
  };
}
type ManualContextValue = ManualState & ReturnType<typeof createManualActions> & { syncStatus: 'saving' | 'error' | 'idle' };
const Context = createContext<ManualContextValue | null>(null);
export function ManualValuesProvider({ children }: { children: ReactNode }) {
  const [state, reactDispatch] = useReducer(manualReducer, initialManualState);
  const current = useRef(state);
  const actions = useRef<ReturnType<typeof createManualActions> | null>(null);
  if (!actions.current) actions.current = createManualActions(() => current.current, patch => {
    current.current = manualReducer(current.current, patch); reactDispatch(patch);
  });
  const commands = actions.current;
  useEffect(() => { void commands.reload(); }, [commands]);
  return createElement(Context.Provider, { value: { ...state, ...commands, syncStatus: state.pending ? 'saving' : state.error ? 'error' : 'idle' } }, children);
}
export function useManualValues() {
  const value = useContext(Context);
  if (!value) throw new Error('useManualValues requires ManualValuesProvider');
  return value;
}
