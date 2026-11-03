'use client';

import { useEffect, useRef } from 'react';
import { PrintRoot } from './PrintRoot';
import { PrintPanel } from './PrintPanel';
import { PrintChart } from './PrintChart';
import { PrintTable } from './PrintTable';
import { printMountedRoot } from '@/lib/pdf';
import { chartToPngBlob } from '@/lib/png';
import { downloadBlob } from '@/lib/download';
import { exportFilename, type ChartType, type TableSpec, type TimeSeriesSpec, type ViewMode } from '@/lib/dataView';

export type ExportMode = 'pdf' | 'png';

/** Chart widths in CSS px that fill an A4 page with 18 mm margins. */
export const PRINT_WIDTH = { portrait: 658, landscape: 986 } as const;
const PNG_W = 960;
const PNG_H = 420;
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function resolveColor(root: HTMLElement, css: string): string {
  const probe = document.createElement('span');
  probe.style.color = css;
  root.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out;
}

interface ExportHostProps {
  mode: ExportMode;
  title: string;
  subtitle?: string;
  range?: string;
  filters?: string;
  view: ViewMode;
  chartSpec?: TimeSeriesSpec;
  chartType: ChartType;
  table: TableSpec;
  /** Called once when the export finished (or failed). The owner unmounts this component. */
  onDone: (error?: Error) => void;
}

/** Mounts the print tree for one export, runs it once, reports back. */
export function ExportHost({ mode, title, subtitle, range, filters, view, chartSpec, chartType, table, onDone }: ExportHostProps) {
  const started = useRef(false);
  const showChart = view === 'chart' && Boolean(chartSpec);
  const wide = mode === 'pdf' && !showChart && Boolean(table.wide);
  const pdfWidth = wide ? PRINT_WIDTH.landscape : PRINT_WIDTH.portrait;

  useEffect(() => {
    if (started.current) return; // React StrictMode runs effects twice in dev; export only once
    started.current = true;
    (async () => {
      await frame();
      await frame();
      if (mode === 'pdf') {
        await printMountedRoot({ wide });
      } else {
        const root = document.getElementById('print-root');
        const svg = root?.querySelector('svg.recharts-surface') as SVGSVGElement | null;
        if (!root || !svg || !chartSpec) throw new Error('Nothing to export');
        const blob = await chartToPngBlob({
          svg,
          title,
          subtitle: [range && `Range: ${range}`, filters && `Filters: ${filters}`].filter(Boolean).join('  ·  ') || subtitle,
          legend: chartSpec.series.map((s) => ({ label: s.label, color: resolveColor(root, s.color) })),
        });
        downloadBlob(blob, exportFilename(title, 'png'));
      }
    })().then(() => onDone(), (e) => onDone(e instanceof Error ? e : new Error(String(e))));
  }, [mode, wide, title, subtitle, range, filters, chartSpec, onDone]);

  if (mode === 'png') {
    return (
      <PrintRoot widthPx={PNG_W}>
        {chartSpec && <PrintChart spec={chartSpec} chartType={chartType} width={PNG_W} height={PNG_H} legend={false} />}
      </PrintRoot>
    );
  }
  return (
    <PrintRoot widthPx={pdfWidth}>
      <PrintPanel title={title} subtitle={subtitle} range={range} filters={filters}>
        {showChart && chartSpec ? <PrintChart spec={chartSpec} chartType={chartType} width={pdfWidth} height={320} /> : <PrintTable table={table} caption={title} />}
      </PrintPanel>
    </PrintRoot>
  );
}
