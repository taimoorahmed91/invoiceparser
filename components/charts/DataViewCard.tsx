'use client';

import { useCallback, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useToast } from '@/components/toast/ToastProvider';
import { useDataView } from '@/hooks/useDataView';
import { ChartToolbar } from './ChartToolbar';
import { buildExportEntries } from './ExportMenu';
import { SeriesChart } from './SeriesChart';
import { DataTable } from './DataTable';
import { FullscreenDialog } from '@/components/overlay/FullscreenDialog';
import { ExportHost, type ExportMode } from '@/components/print/ExportHost';
import { chartSpecToCsv, tableSpecToCsv } from '@/lib/csv';
import { downloadText } from '@/lib/download';
import { exportFilename, timeSeriesToTable, type TableSpec, type TimeSeriesSpec } from '@/lib/dataView';

export interface DataViewCardProps {
  /** ChartCard opens on the chart, DataPanel on the table. */
  variant: 'chart' | 'table';
  title: string;
  subtitle?: string;
  headingLevel?: 2 | 3;
  /** Live figure under the subtitle (latest value + change). */
  summary?: ReactNode;
  icon?: LucideIcon;
  /** Extra block shown in full screen above the chart and table (min / average / max). */
  fullscreenExtra?: ReactNode;
  /** Stable key for the remembered Chart | Table + chart-type choice (plan §4.11.6), e.g. "overview.monthly-costs". */
  storageKey: string;
  chartSpec?: TimeSeriesSpec;
  tableSpec?: TableSpec;
  /** Printed under the title in PDF / PNG: the range and the active filters. */
  range?: string;
  filters?: string;
  chartHeight?: number;
  tableMaxHeight?: number | string;
  chartDisabledReason?: string;
  className?: string;
  /** Pick an x value (a month) by clicking a column, or Enter on the column the arrow keys are on. */
  onSelectX?: (x: string) => void;
  /** The picked x value, drawn as a soft band. */
  selectedX?: string | null;
  /** Hint read to screen readers with the chart, e.g. "Press Enter on a month to select it." */
  selectHint?: string;
  /** Grow-in animation plays once per page load for this key; later redraws are still (plan §2.6 rule 1). */
  animateOnce?: { key: string; durationMs?: number; delayMs?: number };
  /** Extra control in the toolbar's second row (not shown in full screen). */
  viewExtra?: ReactNode;
}

/**
 * The single implementation behind ChartCard and DataPanel (plan §4.11.2): toolbar, Chart | Table,
 * chart type, Expand, Export. Wrappers only choose the default view and the data they pass.
 */
export function DataViewCard(props: DataViewCardProps) {
  const { variant, title, subtitle, summary: liveSummary, icon, fullscreenExtra, headingLevel = 2, storageKey, chartSpec, tableSpec, range, filters, chartHeight = 320, tableMaxHeight, chartDisabledReason, className, onSelectX, selectedX, selectHint, animateOnce, viewExtra } = props;
  const dv = useDataView({ storageKey, chartSpec, defaultView: variant === 'chart' ? 'chart' : 'table' });
  const toast = useToast();
  const headingId = useId();
  const expandRef = useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportMode | null>(null);
  // Legend chips hide/show a series on screen. Table, CSV, PNG and PDF always use all series.
  const [hidden, setHidden] = useState<string[]>([]);

  const table = useMemo<TableSpec>(() => {
    if (chartSpec) return timeSeriesToTable(chartSpec);
    return tableSpec ?? { columns: [], rows: [] };
  }, [chartSpec, tableSpec]);
  const hasChart = Boolean(chartSpec);
  const empty = table.rows.length === 0;
  const multiSeries = (chartSpec?.series.length ?? 0) > 1;
  const stackable = chartSpec?.stackable !== false;
  const shownSpec = useMemo(
    () => (chartSpec && hidden.length ? { ...chartSpec, series: chartSpec.series.filter((s) => !hidden.includes(s.key)) } : chartSpec),
    [chartSpec, hidden],
  );
  const legend = chartSpec && multiSeries && (
    <div className="dv-legend" role="group" aria-label="Series shown">
      {chartSpec.series.map((s) => {
        const on = !hidden.includes(s.key);
        return (
          <ToggleChip
            key={s.key}
            label={s.label}
            dotColor={s.color}
            pressed={on}
            disabledReason={on && hidden.length === chartSpec.series.length - 1 ? 'Keep at least one series' : undefined}
            onPressedChange={(p) => setHidden((h) => (p ? h.filter((k) => k !== s.key) : [...h, s.key]))}
          />
        );
      })}
    </div>
  );

  const startExport = useCallback((mode: ExportMode) => {
    if (mode === 'pdf') dv.setFullscreen(false); // leave full screen before printing (plan §4.12.2 step 3)
    setExporting(mode);
  }, [dv]);

  const onExportDone = useCallback((error?: Error) => {
    setExporting(null);
    if (error) toast.error(`Couldn't create the export: ${error.message}`);
  }, [toast]);

  const entries = buildExportEntries({
    view: dv.view,
    empty,
    busy: exporting !== null,
    handlers: {
      png: () => startExport('png'),
      pdf: () => startExport('pdf'),
      csv: () => downloadText(dv.view === 'chart' && chartSpec ? chartSpecToCsv(chartSpec) : tableSpecToCsv(table), exportFilename(title, 'csv')),
    },
  });

  const openFullscreen = (from: HTMLElement | null) => {
    setOrigin(from ?? expandRef.current);
    dv.setFullscreen(true);
  };

  const summary = chartSpec && chartSpec.rows.length
    ? `${title}: ${chartSpec.rows.length} ${chartSpec.unit ?? 'months'}, from ${chartSpec.rows[0][chartSpec.xKey]} to ${chartSpec.rows[chartSpec.rows.length - 1][chartSpec.xKey]}.`
    : title;

  const chart = shownSpec && (
    <figure className="dv-figure" style={{ margin: 0 }}>
      <SeriesChart spec={shownSpec} chartType={dv.chartType} height={chartHeight} onSelect={onSelectX} selected={selectedX} animateOnce={animateOnce} />
      <figcaption className="sr-only-text">{summary}{onSelectX && selectHint ? ` ${selectHint}` : ''}</figcaption>
      {legend}
    </figure>
  );

  const toolbarProps = {
    title,
    subtitle,
    summary: liveSummary,
    icon,
    headingLevel,
    state: dv,
    hasChart,
    multiSeries: multiSeries && stackable,
    chartDisabledReason,
    exportEntries: entries,
  } as const;

  return (
    <section className={`dv-card ${className ?? ''}`} aria-labelledby={headingId} data-storage-key={storageKey} data-view={dv.view} data-chart-type={dv.chartType}>
      <span id={headingId} className="sr-only-text">{title}</span>
      <ChartToolbar ref={expandRef} {...toolbarProps} viewExtra={viewExtra} onExpand={openFullscreen} />
      <div className="dv-content" style={{ minHeight: chartHeight }}>
        {empty ? (
          <p className="dv-empty">No data to show yet.</p>
        ) : dv.view === 'chart' && chart ? (
          chart
        ) : (
          <DataTable table={table} caption={title} maxHeight={tableMaxHeight ?? (variant === 'chart' ? chartHeight : undefined)} />
        )}
      </div>

      {dv.fullscreen && (
        <FullscreenDialog ariaLabel={`${title}, full screen`} returnFocusTo={origin} onClose={() => dv.setFullscreen(false)}>
          <div className="fs-shell">
            <ChartToolbar
              {...toolbarProps}
              showExpand={false}
              showViewSwitch={false}
              trailing={<Button variant="secondary" size="sm" onClick={() => dv.setFullscreen(false)}>Close</Button>}
            />
            {fullscreenExtra}
            <p className="fs-hint">Turn your phone sideways for a bigger view.</p>
            <div className="fs-body">
              {chartSpec && (
                <div className="fs-pane fs-chart">
                  {legend}
                  <div className="fs-chart-body">{shownSpec && <SeriesChart spec={shownSpec} chartType={dv.chartType} height="100%" />}</div>
                </div>
              )}
              <div className="fs-pane">
                <DataTable table={table} caption={title} />
              </div>
            </div>
          </div>
        </FullscreenDialog>
      )}

      {exporting && (
        <ExportHost
          mode={exporting}
          title={title}
          subtitle={subtitle}
          range={range}
          filters={filters}
          view={dv.view}
          chartSpec={chartSpec}
          chartType={dv.chartType}
          table={table}
          onDone={onExportDone}
        />
      )}
    </section>
  );
}
