import { describe, it, expect } from 'vitest';
import { activeEntry, pageTitle, NAV_ITEMS } from '../components/shell/nav';
import { parseUiPrefs, serializeUiPrefs, UI_INIT_SCRIPT, UI_PREFS_KEY } from '../lib/uiPrefs';
import vm from 'node:vm';

describe('nav', () => {
  it('has the four destinations in plan order', () => {
    expect(NAV_ITEMS.map((n) => n.href)).toEqual(['/', '/invoices', '/analytics', '/data']);
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
});

describe('ui prefs', () => {
  it('defaults to expanded', () => {
    expect(parseUiPrefs(null)).toEqual({ sidebarCollapsed: false, density: 'comfortable' });
    expect(parseUiPrefs('not json')).toEqual({ sidebarCollapsed: false, density: 'comfortable' });
  });
  it('reads the collapsed flag and ignores junk', () => {
    expect(parseUiPrefs('{"sidebarCollapsed":true}').sidebarCollapsed).toBe(true);
    expect(parseUiPrefs('{"sidebarCollapsed":"yes"}').sidebarCollapsed).toBe(false);
  });
  it('reads density (compact or comfortable) and ignores junk', () => {
    expect(parseUiPrefs('{"density":"compact"}').density).toBe('compact');
    expect(parseUiPrefs('{"density":"comfortable"}').density).toBe('comfortable');
    expect(parseUiPrefs('{"density":"huge"}').density).toBe('comfortable');
  });
  it('merges updates and keeps keys from later phases', () => {
    const out = JSON.parse(serializeUiPrefs({ sidebarCollapsed: true }, '{"density":"compact","future":1}'));
    expect(out).toEqual({ density: 'compact', future: 1, sidebarCollapsed: true });
    expect(JSON.parse(serializeUiPrefs({ density: 'compact' }, '{"sidebarCollapsed":true}'))).toEqual({ sidebarCollapsed: true, density: 'compact' });
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
  it('head script sets data-density only when compact', () => {
    const run = (stored: string) => {
      const attrs: Record<string, string> = {};
      vm.runInNewContext(UI_INIT_SCRIPT, {
        localStorage: { getItem: () => stored },
        document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } },
      });
      return attrs;
    };
    expect(run('{"density":"compact"}')).toEqual({ 'data-density': 'compact' });
    expect(run('{"density":"comfortable"}')).toEqual({});
    expect(run('{"sidebarCollapsed":true,"density":"compact"}')).toEqual({ 'data-sidebar': 'collapsed', 'data-density': 'compact' });
  });
});

import { pageShortTitle } from '../components/shell/nav';
describe('short page title for phones', () => {
  it('Data is "Data" on a phone, every other page keeps its title', () => {
    expect(pageShortTitle('/data')).toBe('Data');
    expect(pageTitle('/data')).toBe('Data & settings');
    expect(pageShortTitle('/invoices')).toBe('Invoices');
    expect(pageShortTitle('/analytics')).toBe('Analytics');
    expect(pageShortTitle('/nope')).toBe('Invoice Parser');
  });
});
