'use client';

import { DataViewCard, type DataViewCardProps } from './DataViewCard';
import type { TableSpec, TimeSeriesSpec } from '@/lib/dataView';

/**
 * A table with the same toolbar (plan §4.11.2). Opens on the table.
 * With `chartSpec` the Chart option works ("show as chart", F55); without it Chart stays visible but unavailable, with the reason.
 */
export function DataPanel(props: Omit<DataViewCardProps, 'variant' | 'chartSpec' | 'tableSpec'> & { table: TableSpec; chartSpec?: TimeSeriesSpec }) {
  const { table, chartSpec, ...rest } = props;
  return <DataViewCard variant="table" tableSpec={table} chartSpec={chartSpec} {...rest} />;
}
