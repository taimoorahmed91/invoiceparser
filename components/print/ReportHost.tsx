'use client';

import { useEffect, useRef } from 'react';
import { PrintRoot } from './PrintRoot';
import { PrintReport, REPORT_WIDTH } from './PrintReport';
import { printMountedRoot } from '@/lib/pdf';
import type { ReportData } from '@/lib/analyticsReport';

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Mounts the report print tree once, prints it, reports back (same lifecycle as ExportHost). */
export function ReportHost({ data, onDone }: { data: ReportData; onDone: (error?: Error) => void }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in dev
    started.current = true;
    (async () => {
      await frame();
      await frame();
      await printMountedRoot({ wide: false });
    })().then(() => onDone(), (e) => onDone(e instanceof Error ? e : new Error(String(e))));
  }, [onDone]);

  return (
    <PrintRoot widthPx={REPORT_WIDTH}>
      <PrintReport data={data} />
    </PrintRoot>
  );
}
