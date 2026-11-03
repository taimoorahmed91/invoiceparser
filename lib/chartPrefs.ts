/**
 * Per-chart memory (plan §4.11.3): localStorage['invoice-parser-chart-prefs'] = { [storageKey]: { view, chartType } }.
 * Keys are the stable storageKeys of §4.11.6. Pure helpers; the hook lives in hooks/useChartPrefs.ts.
 */
import type { ChartType, ViewMode } from './dataView';

export const CHART_PREFS_KEY = 'invoice-parser-chart-prefs';

export interface ChartPref {
  view?: ViewMode;
  chartType?: ChartType;
}
export type ChartPrefs = Record<string, ChartPref>;

const VIEWS: ViewMode[] = ['chart', 'table'];
const TYPES: ChartType[] = ['bar-stacked', 'bar-grouped', 'line', 'area'];

export function parseChartPrefs(raw: string | null | undefined): ChartPrefs {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
    const out: ChartPrefs = {};
    for (const [key, v] of Object.entries(o as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const p = v as Record<string, unknown>;
      const pref: ChartPref = {};
      if (VIEWS.includes(p.view as ViewMode)) pref.view = p.view as ViewMode;
      if (TYPES.includes(p.chartType as ChartType)) pref.chartType = p.chartType as ChartType;
      if (pref.view || pref.chartType) out[key] = pref;
    }
    return out;
  } catch {
    return {};
  }
}

/** Merge one panel's change into the stored object (other panels untouched). */
export function updateChartPref(existingRaw: string | null | undefined, key: string, patch: ChartPref): string {
  const prefs = parseChartPrefs(existingRaw);
  prefs[key] = { ...prefs[key], ...patch };
  return JSON.stringify(prefs);
}

/** "Reset all chart/table view choices" (Data page, Phase 6). */
export function clearedChartPrefs(): string {
  return '{}';
}
