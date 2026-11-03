/**
 * UI preferences stored in localStorage['invoice-parser-ui'] (plan §6.2).
 * Phase 2 uses only `sidebarCollapsed`; Phase 6 adds `density`.
 * Pure helpers, plus the tiny <head> script that sets html[data-sidebar] before first paint
 * so a collapsed sidebar does not flash open.
 */
export const UI_PREFS_KEY = 'invoice-parser-ui';

export interface UiPrefs {
  sidebarCollapsed: boolean;
}

export const DEFAULT_UI_PREFS: UiPrefs = { sidebarCollapsed: false };

export function parseUiPrefs(raw: string | null | undefined): UiPrefs {
  if (!raw) return { ...DEFAULT_UI_PREFS };
  try {
    const o = JSON.parse(raw);
    return { sidebarCollapsed: o?.sidebarCollapsed === true };
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
}catch(x){}})();`;
