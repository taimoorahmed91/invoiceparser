'use client';

import { useMemo } from 'react';
import { ChartCard } from '@/components/charts/ChartCard';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { buildMonthlyRows, monthKeyToYm, rangeLabel, ymToMonthKey, type YearMonth } from '@/lib/analyticsMonthly';
import { overviewRangeSpec, type OverviewRange } from '@/lib/analyticsOverview';
import { monthlyStackedSpec } from '@/lib/analyticsSpecs';
import type { StoredInvoice } from '@/lib/storage';

/**
 * Monthly costs on Overview (plan §4.2): stacked bars, 6M · 12M · All, Chart | Table (replaces the old "Monthly Sum"),
 * Bar | Line | Area, Expand, Export. Clicking a month (or Enter on it) sets the period above.
 * Its own file so Recharts loads only when Overview needs it.
 */
export default function MonthlyCostsCard({
  invoices, range, onRange, period, onPeriod,
}: {
  invoices: StoredInvoice[];
  range: OverviewRange;
  onRange: (r: OverviewRange) => void;
  period: YearMonth;
  onPeriod: (ym: YearMonth) => void;
}) {
  const result = useMemo(() => buildMonthlyRows(invoices, overviewRangeSpec(range)), [invoices, range]);
  const spec = useMemo(() => monthlyStackedSpec(result.rows), [result.rows]);
  const label = rangeLabel(result.from, result.to);

  const select = (month: string) => {
    const ym = monthKeyToYm(month);
    const row = result.rows.find((r) => r.month === month);
    // a month without an invoice is a gap, not something to show
    if (ym && row && row.__empty === 0) onPeriod(ym);
  };

  return (
    <ChartCard
      spec={spec}
      title="Monthly costs"
      subtitle={`Rent, parking and utilities · ${label}`}
      storageKey="overview.monthly-costs"
      chartHeight={320}
      range={label}
      filters="none (all invoices in the range)"
      onSelectX={select}
      selectedX={ymToMonthKey(period)}
      selectHint="Press Enter on a month to show it in the figures above."
      animateOnce={{ key: 'overview.monthly-costs', durationMs: 450, delayMs: 300 }}
      viewExtra={
        <SegmentedControl<OverviewRange>
          aria-label="Chart range"
          size="sm"
          value={range}
          onChange={onRange}
          options={[
            { value: '6m', label: '6M' },
            { value: '12m', label: '12M' },
            { value: 'all', label: 'All' },
          ]}
        />
      }
    />
  );
}
