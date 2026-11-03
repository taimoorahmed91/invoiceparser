'use client';

import { SeriesChart } from '@/components/charts/SeriesChart';
import type { ChartType, TimeSeriesSpec } from '@/lib/dataView';

/** Static chart at a fixed pixel size, plus a real-text legend (so it is extractable in the PDF). */
export function PrintChart({ spec, chartType, width, height, legend = true }: { spec: TimeSeriesSpec; chartType: ChartType; width: number; height: number; legend?: boolean }) {
  return (
    <figure className="print-chart">
      <SeriesChart spec={spec} chartType={chartType} width={width} height={height} interactive={false} />
      {legend && (
        <ul className="print-legend">
          {spec.series.map((s) => (
            <li key={s.key}>
              <span className="print-swatch" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
