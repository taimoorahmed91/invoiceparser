'use client';

import { DataViewCard, type DataViewCardProps } from './DataViewCard';
import type { TimeSeriesSpec } from '@/lib/dataView';

/** A chart with the shared toolbar (plan §4.11). Opens on the chart; Table view shows the same numbers. */
export function ChartCard(props: Omit<DataViewCardProps, 'variant' | 'chartSpec' | 'tableSpec'> & { spec: TimeSeriesSpec }) {
  const { spec, ...rest } = props;
  return <DataViewCard variant="chart" chartSpec={spec} {...rest} />;
}
