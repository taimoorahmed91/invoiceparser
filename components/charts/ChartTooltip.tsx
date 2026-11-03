'use client';

import type { TimeSeriesSpec } from '@/lib/dataView';

interface Payload {
  payload?: Record<string, unknown>;
  dataKey?: string | number;
  value?: number | string;
  color?: string;
}

/** Shared tooltip: surface background, swatch + label + value per series (plan §4.7). */
export function ChartTooltip({ active, payload, label, spec }: { active?: boolean; payload?: Payload[]; label?: string | number; spec: TimeSeriesSpec }) {
  if (!active || !payload?.length) return null;
  const fmt = spec.formatValue ?? String;
  // A month inside the range with no invoice is a gap, not a zero.
  if (payload[0]?.payload?.__empty === 1) {
    return (
      <div className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] leading-[18px] text-ink" style={{ boxShadow: 'var(--shadow-e2)' }}>
        <p className="font-semibold mb-1">{label}</p>
        <p className="text-ink-muted">No invoice</p>
      </div>
    );
  }
  return (
    <div className="rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] leading-[18px] text-ink" style={{ boxShadow: 'var(--shadow-e2)' }}>
      <p className="font-semibold mb-1">{label}</p>
      {spec.series.map((s) => {
        const p = payload.find((x) => String(x.dataKey) === s.key);
        if (!p || p.value === undefined || p.value === null) return null;
        return (
          <p key={s.key} className="flex items-center gap-2 tnum">
            <span aria-hidden="true" className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: s.color }} />
            <span className="text-ink-muted">{s.label}</span>
            <span className="ml-auto pl-4 font-medium">{fmt(Number(p.value))}</span>
          </p>
        );
      })}
    </div>
  );
}
