'use client';

import { useCallback, useSyncExternalStore } from 'react';
import {
  THEME_KEY,
  readThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

/**
 * Module-level store: any component can call useTheme() without a provider,
 * and every caller stays in sync (also across tabs through the `storage` event).
 */
let preference: ThemePreference = 'system';
let initialised = false;
const listeners = new Set<() => void>();
let mql: MediaQueryList | null = null;

function systemDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function apply() {
  const resolved = resolveTheme(preference, systemDark());
  const el = document.documentElement;
  el.classList.toggle('dark', resolved === 'dark');
  el.style.colorScheme = resolved;
}

function emit() {
  apply();
  listeners.forEach((l) => l());
}

function init() {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  try {
    preference = readThemePreference(window.localStorage);
  } catch {
    preference = 'system';
  }
  mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    if (preference === 'system') emit();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY) {
      try {
        preference = readThemePreference(window.localStorage);
      } catch {
        /* ignore */
      }
      emit();
    }
  });
  apply();
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): ThemePreference => {
  init();
  return preference;
};
const getServerSnapshot = (): ThemePreference => 'system';

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
} {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setPreference = useCallback((p: ThemePreference) => {
    preference = p;
    try {
      window.localStorage.setItem(THEME_KEY, p);
    } catch {
      /* private mode: keep in memory only */
    }
    emit();
  }, []);
  // `resolved` is only meaningful on the client; on the server it is 'light'.
  const resolved: ResolvedTheme =
    typeof window === 'undefined' ? 'light' : resolveTheme(pref, systemDark());
  return { preference: pref, resolved, setPreference };
}
