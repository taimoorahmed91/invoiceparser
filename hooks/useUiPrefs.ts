'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { UI_PREFS_KEY, parseUiPrefs, serializeUiPrefs, type UiPrefs } from '@/lib/uiPrefs';

/** Tiny store over localStorage['invoice-parser-ui'], kept in sync across components and tabs. */
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: UiPrefs } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(UI_PREFS_KEY);
  } catch {
    return null;
  }
}

function snapshot(): UiPrefs {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, value: parseUiPrefs(raw) };
  return cache.value;
}

const SERVER: UiPrefs = { sidebarCollapsed: false, density: 'comfortable' };

function applyAttribute(p: UiPrefs) {
  const el = document.documentElement;
  if (p.sidebarCollapsed) el.setAttribute('data-sidebar', 'collapsed');
  else el.removeAttribute('data-sidebar');
  if (p.density === 'compact') el.setAttribute('data-density', 'compact');
  else el.removeAttribute('data-density');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === UI_PREFS_KEY) {
      applyAttribute(snapshot());
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useUiPrefs(): { prefs: UiPrefs; update: (u: Partial<UiPrefs>) => void } {
  const prefs = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const update = useCallback((u: Partial<UiPrefs>) => {
    const next = serializeUiPrefs(u, readRaw());
    try {
      window.localStorage.setItem(UI_PREFS_KEY, next);
    } catch {
      /* private mode: in-memory only */
      cache = { raw: next, value: parseUiPrefs(next) };
    }
    applyAttribute(snapshot());
    listeners.forEach((l) => l());
  }, []);
  return { prefs, update };
}
