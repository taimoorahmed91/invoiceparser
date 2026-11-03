'use client';

import { useCallback, useState } from 'react';
import { useChartPref } from './useChartPrefs';
import {
  chartKindOptions,
  chartTypeFromKind,
  chartTypeKind,
  resolveChartType,
  type ChartKind,
  type ChartKindOption,
  type ChartType,
  type TimeSeriesSpec,
  type ViewMode,
} from '@/lib/dataView';

export interface DataViewState {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  /** What is drawn right now (a remembered Line/Area falls back to Bar Stacked while it is unavailable). */
  chartType: ChartType;
  chartKind: ChartKind;
  kindOptions: ChartKindOption[];
  /** Stacked flavour of Bar, from the remembered choice (default stacked). */
  barStacked: boolean;
  setChartKind: (kind: ChartKind) => void;
  setBarStacked: (stacked: boolean) => void;
  fullscreen: boolean;
  setFullscreen: (open: boolean) => void;
}

/**
 * One state machine for ChartCard and DataPanel (plan §4.11.2): Chart | Table, chart type with the ≥ 4-point rule,
 * full screen. The Chart | Table and chart-type choices are remembered per storageKey.
 */
export function useDataView(opts: { storageKey: string; chartSpec?: TimeSeriesSpec; defaultView: ViewMode }): DataViewState {
  const { storageKey, chartSpec, defaultView } = opts;
  const [pref, setPref] = useChartPref(storageKey);
  const [fullscreen, setFullscreen] = useState(false);

  const hasChart = Boolean(chartSpec);
  const view: ViewMode = hasChart ? pref.view ?? defaultView : 'table';
  const chartType = chartSpec ? resolveChartType(pref.chartType, chartSpec) : 'bar-stacked';
  const kindOptions = chartSpec ? chartKindOptions(chartSpec) : [];
  const barStacked = pref.chartType !== 'bar-grouped';

  const setView = useCallback((v: ViewMode) => setPref({ view: v }), [setPref]);
  const setChartKind = useCallback((kind: ChartKind) => setPref({ chartType: chartTypeFromKind(kind, barStacked) }), [setPref, barStacked]);
  const setBarStacked = useCallback((stacked: boolean) => setPref({ chartType: chartTypeFromKind('bar', stacked) }), [setPref]);

  return { view, setView, chartType, chartKind: chartTypeKind(chartType), kindOptions, barStacked, setChartKind, setBarStacked, fullscreen, setFullscreen };
}
