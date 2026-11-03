'use client';

import { useMemo } from 'react';
import { CalendarX } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { buildMonthlyRows, rangeLabel, type RangeSpec } from '@/lib/analyticsMonthly';
import { fmtDelta, fmtMoney } from '@/lib/format';
import type { TimeSeriesSpec } from '@/lib/dataView';
import type { StoredInvoice } from '@/lib/storage';

export type MonthlyLayout = 'stacked' | 'separate';

const SERIES = {
  Rent: { key: 'Rent', label: 'Rent', color: 'var(--rent)' },
  Parking: { key: 'Parking', label: 'Parking', color: 'var(--parking)' },
  Utility: { key: 'Utility', label: 'Utility', color: 'var(--utility)' },
} as const;

/**
 * Analytics → Monthly costs (plan §4.7 tab 1).
 * Stacked: Rent / Parking / Utility per month with the total above each bar.
 * Separate scales: Rent, Parking and Utility each in their own chart with their own y axis
 * (rent is in the thousands, parking in the hundreds, so one shared axis hides parking).
 * Every chart is a ChartCard (Chart | Table, Bar | Line | Area, Full screen, Export).
 */
export default function MonthlyCostsTab({
  invoices, range, layout, onLayout, onResetRange,
}: {
  invoices: StoredInvoice[];
  range: RangeSpec;
  layout: MonthlyLayout;
  onLayout: (l: MonthlyLayout) => void;
  onResetRange: () => void;
}) {
  const result = useMemo(() => buildMonthlyRows(invoices, range), [invoices, range]);
  const label = rangeLabel(result.from, result.to);
  const populated = result.rows.filter((r) => r.__empty === 0).length;

  const specs = useMemo(() => {
    const base = {
      xKey: 'month',
      xLabel: 'Month',
      rows: result.rows,
      formatValue: (n: number) => fmtMoney(n),
      deltaColumn: { label: 'Change vs previous month', format: (c: number, p: number) => fmtDelta(c, p).text },
    };
    const stacked: TimeSeriesSpec = { ...base, series: [SERIES.Rent, SERIES.Parking, SERIES.Utility], allowArea: true, showTotal: true, totalLabels: true };
    const single = (s: (typeof SERIES)[keyof typeof SERIES]): TimeSeriesSpec => ({ ...base, series: [s] });
    return { stacked, rent: single(SERIES.Rent), parking: single(SERIES.Parking), utility: single(SERIES.Utility) };
  }, [result.rows]);

  if (populated === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title="No invoices in this range"
        action={
          <Button variant="secondary" onClick={onResetRange}>
            Reset range
          </Button>
        }
      >
        Pick another range, or reset it to see all your invoices.
      </EmptyState>
    );
  }

  const common = { range: label, filters: 'none (all invoices in the range)' } as const;

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<MonthlyLayout>
        aria-label="Chart layout"
        size="sm"
        value={layout}
        onChange={onLayout}
        options={[
          { value: 'stacked', label: 'Stacked' },
          { value: 'separate', label: 'Separate scales' },
        ]}
      />
      {layout === 'stacked' ? (
        <ChartCard
          spec={specs.stacked}
          title="Monthly costs"
          subtitle={`Rent, parking and utilities · ${label}`}
          storageKey="analytics.monthly.stacked"
          chartHeight={340}
          {...common}
        />
      ) : (
        <>
          <ChartCard spec={specs.rent} title="Rent" subtitle={`Gross per month · ${label}`} storageKey="analytics.monthly.rent" chartHeight={260} headingLevel={2} {...common} />
          <ChartCard spec={specs.parking} title="Parking" subtitle={`Gross per month · ${label}`} storageKey="analytics.monthly.parking" chartHeight={260} headingLevel={2} {...common} />
          <ChartCard spec={specs.utility} title="Utility" subtitle={`Gross per month · ${label}`} storageKey="analytics.monthly.utility" chartHeight={260} headingLevel={2} {...common} />
        </>
      )}
    </div>
  );
}
