'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompactMoney, fmtMonthTick } from '@/lib/format';
import { isStackedType, type ChartType, type TimeSeriesSpec } from '@/lib/dataView';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ChartTooltip } from './ChartTooltip';

interface SeriesChartProps {
  spec: TimeSeriesSpec;
  chartType: ChartType;
  height: number | `${number}%`;
  /** Fixed pixel width (print tree, PNG export). Omit for a responsive chart that fills its container. */
  width?: number;
  /** Tooltip + keyboard layer; off in the static print/PNG render. */
  interactive?: boolean;
  yTick?: (n: number) => string;
}

/**
 * Generic Bar (stacked / grouped) | Line | Area renderer driven by a TimeSeriesSpec. It is what the shared
 * toolbar draws today; Phase 4a adds the specialised bodies (StackedBars, SmallBars, YearLines) that plug into the same
 * ChartCard. Colours are tokens ("var(--rent)"), so the same chart is light inside the print tree and themed on screen.
 */
export function SeriesChart({ spec, chartType, height, width, interactive = true, yTick = fmtCompactMoney }: SeriesChartProps) {
  const reduced = useReducedMotion();
  const roomy = useMediaQuery('(min-width: 640px)');
  const animate = interactive && !reduced;
  const stacked = isStackedType(chartType);
  // Total above each stacked bar: only for stacked bars, not on phones (too crowded), and not for very long series.
  const totals = Boolean(spec.totalLabels) && chartType === 'bar-stacked' && spec.series.length > 1 && (roomy || !interactive) && spec.rows.length <= 24;
  const data = totals
    ? spec.rows.map((r) => {
        const vals = spec.series.map((s) => (typeof r[s.key] === 'number' ? (r[s.key] as number) : null));
        return { ...r, __zero: 0, __sum: vals.every((v) => v === null) ? null : vals.reduce<number>((a, v) => a + (v ?? 0), 0) };
      })
    : spec.rows;
  const common = { data, margin: { top: totals ? 22 : 12, right: 12, left: 0, bottom: 4 } };

  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis
        dataKey={spec.xKey}
        tickFormatter={(v) => fmtMonthTick(String(v))}
        tick={{ fontSize: 12, fill: 'var(--ink-muted)' }}
        stroke="var(--control-border)"
        interval="preserveStartEnd"
        tickMargin={6}
      />
      <YAxis tickFormatter={yTick} tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} stroke="var(--control-border)" width={52} />
      {interactive && <Tooltip content={<ChartTooltip spec={spec} />} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} />}
    </>
  );

  let chart;
  if (chartType === 'line') {
    chart = (
      <LineChart {...common} accessibilityLayer={interactive} width={width} height={width ? (height as number) : undefined}>
        {axes}
        {spec.series.map((s) => (
          <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 3, fill: s.color }} isAnimationActive={animate} />
        ))}
      </LineChart>
    );
  } else if (chartType === 'area') {
    chart = (
      <AreaChart {...common} accessibilityLayer={interactive} width={width} height={width ? (height as number) : undefined}>
        {axes}
        {spec.series.map((s) => (
          <Area key={s.key} dataKey={s.key} name={s.label} stackId="a" stroke={s.color} fill={s.color} fillOpacity={0.35} strokeWidth={2} isAnimationActive={animate} />
        ))}
      </AreaChart>
    );
  } else {
    chart = (
      <BarChart {...common} accessibilityLayer={interactive} width={width} height={width ? (height as number) : undefined}>
        {axes}
        {spec.series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? 'a' : undefined}
            stroke={stacked ? 'var(--surface)' : undefined}
            strokeWidth={stacked ? 1.5 : 0}
            radius={stacked ? 0 : [3, 3, 0, 0]}
            isAnimationActive={animate}
          />
        ))}
        {totals && (
          <Bar dataKey="__zero" stackId="a" fill="transparent" legendType="none" isAnimationActive={animate} activeBar={false}>
            <LabelList
              dataKey="__sum"
              position="top"
              formatter={(v: unknown) => (typeof v === 'number' ? fmtCompactMoney(v) : '')}
              style={{ fontSize: 11, fill: 'var(--ink-muted)' }}
            />
          </Bar>
        )}
      </BarChart>
    );
  }

  if (width) return chart;
  return (
    // initialDimension: the first render happens before the container is measured; without it Recharts logs a width(-1) warning.
    <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height: typeof height === 'number' ? height : 320 }}>
      {chart}
    </ResponsiveContainer>
  );
}
