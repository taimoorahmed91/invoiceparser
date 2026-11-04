/**
 * UI preferences stored in localStorage['invoice-parser-ui'] (plan §6.2).
 * `sidebarCollapsed` (the sidebar / icon rail) and `density` (Data → Appearance: table row height 52 / 40 px).
 * Pure helpers, plus the tiny <head> script that sets html[data-sidebar] and html[data-density] before first paint
 * so a collapsed sidebar or compact tables do not flash.
 */
export const UI_PREFS_KEY = 'invoice-parser-ui';

export type Density = 'comfortable' | 'compact';

export interface UiPrefs {
  sidebarCollapsed: boolean;
  density: Density;
}

export const DEFAULT_UI_PREFS: UiPrefs = { sidebarCollapsed: false, density: 'comfortable' };

export function parseUiPrefs(raw: string | null | undefined): UiPrefs {
  if (!raw) return { ...DEFAULT_UI_PREFS };
  try {
    const o = JSON.parse(raw);
    return { sidebarCollapsed: o?.sidebarCollapsed === true, density: o?.density === 'compact' ? 'compact' : 'comfortable' };
  } catch {
    return { ...DEFAULT_UI_PREFS };
  }
}

/** Merge into whatever is stored, so keys added by later phases survive. */
export function serializeUiPrefs(update: Partial<UiPrefs>, existingRaw: string | null | undefined): string {
  let base: Record<string, unknown> = {};
  try {
    const o = existingRaw ? JSON.parse(existingRaw) : {};
    if (o && typeof o === 'object' && !Array.isArray(o)) base = o;
  } catch {
    /* ignore corrupt value */
  }
  return JSON.stringify({ ...base, ...update });
}

export const UI_INIT_SCRIPT = `(function(){try{
var o=JSON.parse(localStorage.getItem('${UI_PREFS_KEY}')||'{}');
if(o&&o.sidebarCollapsed===true)document.documentElement.setAttribute('data-sidebar','collapsed');
if(o&&o.density==='compact')document.documentElement.setAttribute('data-density','compact');
}catch(x){}})();`;
