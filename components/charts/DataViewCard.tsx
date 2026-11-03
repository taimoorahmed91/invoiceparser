'use client';

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
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
}

/**
 * The single implementation behind ChartCard and DataPanel (plan §4.11.2): toolbar, Chart | Table,
 * chart type, Expand, Export. Wrappers only choose the default view and the data they pass.
 */
export function DataViewCard(props: DataViewCardProps) {
  const { variant, title, subtitle, headingLevel = 2, storageKey, chartSpec, tableSpec, range, filters, chartHeight = 320, tableMaxHeight, chartDisabledReason, className } = props;
  const dv = useDataView({ storageKey, chartSpec, defaultView: variant === 'chart' ? 'chart' : 'table' });
  const toast = useToast();
  const headingId = useId();
  const expandRef = useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = useState<HTMLElement | null>(null);
  const [exporting, setExporting] = useState<ExportMode | null>(null);

  const table = useMemo<TableSpec>(() => {
    if (chartSpec) return timeSeriesToTable(chartSpec);
    return tableSpec ?? { columns: [], rows: [] };
  }, [chartSpec, tableSpec]);
  const hasChart = Boolean(chartSpec);
  const empty = table.rows.length === 0;
  const multiSeries = (chartSpec?.series.length ?? 0) > 1;

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

  const chart = chartSpec && (
    <figure className="dv-figure" style={{ margin: 0 }}>
      <SeriesChart spec={chartSpec} chartType={dv.chartType} height={chartHeight} />
      <figcaption className="sr-only-text">{summary}</figcaption>
    </figure>
  );

  const toolbarProps = {
    title,
    subtitle,
    headingLevel,
    state: dv,
    hasChart,
    multiSeries,
    chartDisabledReason,
    exportEntries: entries,
  } as const;

  return (
    <section className={`dv-card ${className ?? ''}`} aria-labelledby={headingId} data-storage-key={storageKey} data-view={dv.view} data-chart-type={dv.chartType}>
      <span id={headingId} className="sr-only-text">{title}</span>
      <ChartToolbar ref={expandRef} {...toolbarProps} onExpand={openFullscreen} />
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
            <p className="fs-hint">Turn your phone sideways for a bigger view.</p>
            <div className="fs-body">
              {chartSpec && (
                <div className="fs-pane fs-chart">
                  <SeriesChart spec={chartSpec} chartType={dv.chartType} height="100%" />
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
