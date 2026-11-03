import { describe, it, expect } from 'vitest';
import vm from 'node:vm';
import { THEME_INIT_SCRIPT, readThemePreference, resolveTheme, THEME_KEY, LEGACY_DARK_KEY } from '../lib/theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

function runInitScript(storage: ReturnType<typeof fakeStorage>, systemDark: boolean) {
  const classes = new Set<string>();
  const el = {
    classList: { toggle: (c: string, on: boolean) => (on ? classes.add(c) : classes.delete(c)) },
    style: { colorScheme: '' },
  };
  vm.runInNewContext(THEME_INIT_SCRIPT, {
    localStorage: storage,
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: el },
  });
  return { dark: classes.has('dark'), colorScheme: el.style.colorScheme };
}

describe('resolveTheme', () => {
  it('follows the system only for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readThemePreference (legacy migration)', () => {
  it('defaults to system', () => {
    expect(readThemePreference(fakeStorage())).toBe('system');
  });
  it('keeps a saved preference', () => {
    expect(readThemePreference(fakeStorage({ [THEME_KEY]: 'light' }))).toBe('light');
  });
  it("migrates legacy 'true' to dark and removes the old key", () => {
    const s = fakeStorage({ [LEGACY_DARK_KEY]: 'true' });
    expect(readThemePreference(s)).toBe('dark');
    expect(s.data[THEME_KEY]).toBe('dark');
    expect(LEGACY_DARK_KEY in s.data).toBe(false);
  });
  it("migrates legacy 'false' to system (old page wrote false by default)", () => {
    const s = fakeStorage({ [LEGACY_DARK_KEY]: 'false' });
    expect(readThemePreference(s)).toBe('system');
    expect(s.data[THEME_KEY]).toBe('system');
  });
  it('ignores garbage in the new key', () => {
    expect(readThemePreference(fakeStorage({ [THEME_KEY]: 'purple' }))).toBe('system');
  });
});

describe('THEME_INIT_SCRIPT (runs in <head>, must match the TS rules)', () => {
  it('applies dark for saved dark', () => {
    expect(runInitScript(fakeStorage({ [THEME_KEY]: 'dark' }), false)).toEqual({ dark: true, colorScheme: 'dark' });
  });
  it('applies light for saved light even if the system is dark', () => {
    expect(runInitScript(fakeStorage({ [THEME_KEY]: 'light' }), true)).toEqual({ dark: false, colorScheme: 'light' });
  });
  it('follows the system by default', () => {
    expect(runInitScript(fakeStorage(), true).dark).toBe(true);
    expect(runInitScript(fakeStorage(), false).dark).toBe(false);
  });
  it('migrates the legacy key', () => {
    const s = fakeStorage({ [LEGACY_DARK_KEY]: 'true' });
    expect(runInitScript(s, false).dark).toBe(true);
    expect(s.data[THEME_KEY]).toBe('dark');
    expect(LEGACY_DARK_KEY in s.data).toBe(false);
  });
});
