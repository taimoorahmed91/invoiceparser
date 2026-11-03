'use client';

import { useMemo } from 'react';
import { Droplet, Droplets, Flame, FileX, Trash2, Zap, type LucideIcon } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { rangeLabel, type RangeSpec } from '@/lib/analyticsMonthly';
import {
  UTILITY_KEYS, UTILITY_META, buildUtilityRows, isMetricAvailable, latestDelta, latestValue, metricCaption, metricFormatter, seriesStats,
  type UtilityKey, type UtilityMetricKey,
} from '@/lib/analyticsUtilities';
import { fmtMoney } from '@/lib/format';
import { utilityAllSpec, utilityCardSpec } from '@/lib/analyticsSpecs';
import type { StoredInvoice } from '@/lib/storage';

const ICONS: Record<UtilityKey, LucideIcon> = {
  'Cold Water': Droplet,
  'Hot Water': Droplets,
  Electricity: Zap,
  'Central Heating': Flame,
  'Waste Management': Trash2,
};

type AnyRow = Record<string, unknown> & { month: string };

function Summary({ rows, rowKey, fmt }: { rows: AnyRow[]; rowKey: string; fmt: (n: number) => string }) {
  const latest = latestValue(rows, rowKey);
  if (!latest) return <span className="text-[13px] text-ink-subtle">No data in this range</span>;
  const delta = latestDelta(latest, fmt);
  return (
    <>
      <span className="text-[22px] leading-7 font-semibold tnum">
        <RollingNumber value={fmt(latest.value)} />
      </span>
      <span className="text-[13px] leading-[18px] text-ink-muted">{latest.month}</span>
      {delta && delta.direction !== 'flat' ? (
        <span className={`text-[13px] leading-[18px] tnum ${delta.direction === 'up' ? 'text-increase' : 'text-decrease'}`}>
          {delta.text} <span className="text-ink-subtle">vs {latest.previousMonth}</span>
        </span>
      ) : delta ? (
        <span className="text-[13px] leading-[18px] text-ink-muted">No change vs {latest.previousMonth}</span>
      ) : (
        <span className="text-[13px] leading-[18px] text-ink-subtle">No earlier month to compare</span>
      )}
    </>
  );
}

function Stats({ rows, rowKey, fmt }: { rows: AnyRow[]; rowKey: string; fmt: (n: number) => string }) {
  const s = seriesStats(rows, rowKey);
  if (!s) return null;
  return (
    <dl className="dv-stats" aria-label="Statistics for the months with data">
      <div><dt>Minimum</dt><dd>{fmt(s.min.value)} <span className="font-normal text-ink-muted">({s.min.month})</span></dd></div>
      <div><dt>Average</dt><dd>{fmt(s.avg)}</dd></div>
      <div><dt>Maximum</dt><dd>{fmt(s.max.value)} <span className="font-normal text-ink-muted">({s.max.month})</span></dd></div>
      <div><dt>Months with data</dt><dd>{s.count}</dd></div>
    </dl>
  );
}

/**
 * Analytics → Utilities (plan §4.7 tab 2): one metric switch (Cost · Usage · Unit price) drives five small ChartCards,
 * one per sub-type, in the sub-type colour, each with latest value + change, Chart | Table, Bar | Line, Full screen
 * (with min / average / max) and Export. Cost adds an "All utilities" stacked card on top.
 */
export default function UtilitiesTab({
  invoices, range, metric, onMetric, onResetRange,
}: {
  invoices: StoredInvoice[];
  range: RangeSpec;
  metric: UtilityMetricKey;
  onMetric: (m: UtilityMetricKey) => void;
  onResetRange: () => void;
}) {
  const result = useMemo(() => buildUtilityRows(invoices, range, metric), [invoices, range, metric]);
  const label = rangeLabel(result.from, result.to);
  const hasData = result.rows.some((r) => r.__empty === 0);
  const keys = UTILITY_KEYS.filter((k) => isMetricAvailable(k, metric));
  const hiddenWaste = !isMetricAvailable('Waste Management', metric);

  const cards = useMemo(
    () =>
      keys.map((key) => {
        const unit = result.units[key];
        const fmt = metricFormatter(metric, unit);
        const spec = utilityCardSpec(result, key, metric);
        return { key, unit, fmt, spec, rows: spec.rows as AnyRow[] };
      }),
    [keys.join('|'), result, metric], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const allSpec = useMemo(() => utilityAllSpec(result.rows), [result.rows]);

  const metricSwitch = (
    <SegmentedControl<UtilityMetricKey>
      aria-label="Metric"
      size="sm"
      value={metric}
      onChange={onMetric}
      options={[
        { value: 'cost', label: 'Cost' },
        { value: 'usage', label: 'Usage' },
        { value: 'price', label: 'Unit price' },
      ]}
    />
  );

  if (!hasData) {
    return (
      <div className="flex flex-col gap-4">
        {metricSwitch}
        <EmptyState
          icon={FileX}
          title="No utility invoices in this range"
          action={<Button variant="secondary" onClick={onResetRange}>Reset range</Button>}
        >
          Utility invoices (water, electricity, heating, waste) will show up here. Pick another range, or reset it to see all invoices.
        </EmptyState>
      </div>
    );
  }

  const common = { range: label, filters: 'none (all invoices in the range)' } as const;

  return (
    <div className="flex flex-col gap-4">
      {metricSwitch}
      {metric === 'cost' && (
        <ChartCard
          spec={allSpec}
          title="All utilities"
          subtitle={`The five sub-types stacked · ${label}`}
          storageKey="analytics.utilities.cost.all"
          chartHeight={320}
          fullscreenExtra={<Stats rows={result.rows.map((r) => ({ month: r.month, total: UTILITY_KEYS.every((k) => r[k] === null) ? null : UTILITY_KEYS.reduce((s, k) => s + ((r[k] as number | null) ?? 0), 0) }))} rowKey="total" fmt={(n) => fmtMoney(n)} />}
          {...common}
        />
      )}
      <div className="an-grid">
        {cards.map(({ key, unit, fmt, spec, rows }) => (
          <ChartCard
            key={`${metric}-${key}`}
            spec={spec}
            title={key}
            icon={ICONS[key]}
            subtitle={`${UTILITY_META[key].polish} · ${metricCaption(metric, unit)}`}
            summary={<Summary rows={rows} rowKey="value" fmt={fmt} />}
            fullscreenExtra={<Stats rows={rows} rowKey="value" fmt={fmt} />}
            storageKey={`analytics.utilities.${metric}.${UTILITY_META[key].slug}`}
            chartHeight={220}
            headingLevel={2}
            {...common}
          />
        ))}
      </div>
      {hiddenWaste && <p className="an-note">Waste Management is billed as a flat monthly fee, so it has no usage or unit-price chart. See it under Cost.</p>}
    </div>
  );
}
