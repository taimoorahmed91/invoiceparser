import { describe, it, expect } from 'vitest';
import { activeEntry, isEnabled, pageTitle, NAV_ITEMS, ENABLED_ROUTES, unavailableReason } from '../components/shell/nav';
import { parseUiPrefs, serializeUiPrefs, UI_INIT_SCRIPT, UI_PREFS_KEY } from '../lib/uiPrefs';
import vm from 'node:vm';

describe('nav', () => {
  it('has the four destinations in plan order', () => {
    expect(NAV_ITEMS.map((n) => n.href)).toEqual(['/', '/invoices', '/analytics', '/data']);
  });
  it('Phase 5 enables Overview, Invoices and Analytics; Data is not built yet', () => {
    expect(ENABLED_ROUTES).toEqual(['/', '/invoices', '/analytics']);
    expect(isEnabled('/invoices')).toBe(true);
    expect(isEnabled('/analytics')).toBe(true);
    expect(isEnabled('/')).toBe(true);
    expect(isEnabled('/data')).toBe(false);
    expect(isEnabled('/data', ['/data'])).toBe(true);
  });
  it('matches the active item from the pathname', () => {
    expect(activeEntry('/invoices')?.label).toBe('Invoices');
    expect(activeEntry('/invoices/')?.label).toBe('Invoices');
    expect(activeEntry('/invoices?invoice=1')?.label).toBe('Invoices');
    expect(activeEntry('/invoices/abc')?.label).toBe('Invoices');
    expect(activeEntry('/')?.label).toBe('Overview');
    expect(activeEntry('/data')?.label).toBe('Data');
    expect(activeEntry('/dev/ui')).toBeNull();
    expect(activeEntry('/invoicesx')).toBeNull();
    expect(activeEntry(null)).toBeNull();
  });
  it('page titles', () => {
    expect(pageTitle('/invoices')).toBe('Invoices');
    expect(pageTitle('/data')).toBe('Data & settings');
    expect(pageTitle('/nope')).toBe('Invoice Parser');
  });
  it('gives a plain reason for unavailable items', () => {
    expect(unavailableReason(NAV_ITEMS[3])).toBe('Data is coming in a later update');
  });
});

describe('ui prefs', () => {
  it('defaults to expanded', () => {
    expect(parseUiPrefs(null)).toEqual({ sidebarCollapsed: false });
    expect(parseUiPrefs('not json')).toEqual({ sidebarCollapsed: false });
  });
  it('reads the collapsed flag and ignores junk', () => {
    expect(parseUiPrefs('{"sidebarCollapsed":true}').sidebarCollapsed).toBe(true);
    expect(parseUiPrefs('{"sidebarCollapsed":"yes"}').sidebarCollapsed).toBe(false);
  });
  it('merges updates and keeps keys from later phases', () => {
    const out = JSON.parse(serializeUiPrefs({ sidebarCollapsed: true }, '{"density":"compact"}'));
    expect(out).toEqual({ density: 'compact', sidebarCollapsed: true });
    expect(JSON.parse(serializeUiPrefs({ sidebarCollapsed: false }, 'garbage'))).toEqual({ sidebarCollapsed: false });
  });
  it('head script sets data-sidebar before paint only when collapsed', () => {
    const run = (stored: string | null) => {
      const attrs: Record<string, string> = {};
      vm.runInNewContext(UI_INIT_SCRIPT, {
        localStorage: { getItem: (k: string) => (k === UI_PREFS_KEY ? stored : null) },
        document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
      });
      return attrs;
    };
    expect(run('{"sidebarCollapsed":true}')).toEqual({ 'data-sidebar': 'collapsed' });
    expect(run('{"sidebarCollapsed":false}')).toEqual({});
    expect(run(null)).toEqual({});
    expect(run('{bad')).toEqual({});
  });
});
