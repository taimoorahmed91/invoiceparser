'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { CHART_PREFS_KEY, clearedChartPrefs, parseChartPrefs, updateChartPref, type ChartPref } from '@/lib/chartPrefs';

/** Tiny shared store over localStorage['invoice-parser-chart-prefs'] (same pattern as useUiPrefs). */
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: ReturnType<typeof parseChartPrefs> } | null = null;
const EMPTY = {};

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CHART_PREFS_KEY);
  } catch {
    return null;
  }
}
function snapshot() {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, value: parseChartPrefs(raw) };
  return cache.value;
}
function write(next: string) {
  try {
    window.localStorage.setItem(CHART_PREFS_KEY, next);
  } catch {
    cache = { raw: next, value: parseChartPrefs(next) }; // private mode: memory only
  }
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHART_PREFS_KEY) cb();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Remembered { view, chartType } for one panel, and a setter that merges into storage. */
export function useChartPref(storageKey: string): [ChartPref, (patch: ChartPref) => void] {
  const all = useSyncExternalStore(subscribe, snapshot, () => EMPTY as ReturnType<typeof parseChartPrefs>);
  const set = useCallback((patch: ChartPref) => write(updateChartPref(readRaw(), storageKey, patch)), [storageKey]);
  return [all[storageKey] ?? (EMPTY as ChartPref), set];
}

/** Used by Data → Appearance → "Reset all chart/table view choices" (Phase 6). */
export function resetChartPrefs() {
  write(clearedChartPrefs());
}
