/**
 * Theme helpers (plan §5.3). Pure — the hook in hooks/useTheme.ts and the
 * inline <head> script both follow these exact rules.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_KEY = 'invoice-parser-theme';
/** Legacy boolean key written by the old page: 'true' | 'false'. */
export const LEGACY_DARK_KEY = 'invoice-parser-dark-mode';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark ? 'dark' : 'light';
  return pref;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Reads the saved preference, migrating the legacy key once.
 * Legacy 'true' → 'dark'. Legacy 'false' → 'system': the old page wrote
 * 'false' on every first load, so it does not prove the user picked light.
 */
export function readThemePreference(storage: StorageLike): ThemePreference {
  const saved = storage.getItem(THEME_KEY);
  if (isThemePreference(saved)) return saved;
  const legacy = storage.getItem(LEGACY_DARK_KEY);
  if (legacy !== null) {
    const migrated: ThemePreference = legacy === 'true' ? 'dark' : 'system';
    storage.setItem(THEME_KEY, migrated);
    storage.removeItem(LEGACY_DARK_KEY);
    return migrated;
  }
  return 'system';
}

/**
 * Runs in <head> before first paint so a hard reload in dark mode never
 * flashes light. Same rules as readThemePreference/resolveTheme above.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var K='${THEME_KEY}',L='${LEGACY_DARK_KEY}',s=localStorage,t=s.getItem(K);
if(t!=='light'&&t!=='dark'&&t!=='system'){
  t='system';var l=s.getItem(L);
  if(l!==null){t=l==='true'?'dark':'system';s.setItem(K,t);s.removeItem(L);}
}
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';
}catch(x){}})();`;
