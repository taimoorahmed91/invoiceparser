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
export function SeriesChart({ spec, chartType, height, width, interactive = true, yTick: yTickProp }: SeriesChartProps) {
  const yTick = yTickProp ?? spec.yTick ?? fmtCompactMoney;
  const reduced = useReducedMotion();
  const roomy = useMediaQuery('(min-width: 640px)');
  const animate = interactive && !reduced;
  const stacked = isStackedType(chartType) && spec.stackable !== false;
  // Total above each stacked bar: only for stacked bars, not on phones (too crowded), and not for very long series.
  const totals = Boolean(spec.totalLabels) && chartType === 'bar-stacked' && spec.series.length > 1 && (roomy || !interactive) && spec.rows.length <= 24;
  const data = totals
    ? spec.rows.map((r) => {
        const vals = spec.series.map((s) => (typeof r[s.key] === 'number' ? (r[s.key] as number) : null));
        return { ...r, __zero: 0, __sum: vals.every((v) => v === null) ? null : vals.reduce<number>((a, v) => a + (v ?? 0), 0) };
      })
    : spec.rows;
  const endLabels = Boolean(spec.endLabels) && chartType === 'line';
  const common = { data, margin: { top: totals ? 22 : 12, right: endLabels ? 44 : 12, left: 0, bottom: 4 } };

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
        {spec.series.map((s) => {
          const st = s.style ?? {};
          // index of this line's last point, for the end-of-line label
          let last = -1;
          spec.rows.forEach((r, i) => {
            if (typeof r[s.key] === 'number') last = i;
          });
          return (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={st.pointsOnly ? 0 : st.width ?? 2.5}
              strokeDasharray={st.dash}
              strokeOpacity={st.opacity ?? 1}
              connectNulls={false}
              dot={{ r: st.pointsOnly ? 4 : 3, fill: s.color, fillOpacity: st.opacity ?? 1, strokeWidth: 0 }}
              isAnimationActive={animate}
              label={
                endLabels
                  ? (p: { x?: number | string; y?: number | string; index?: number }) =>
                      p.index === last && typeof p.x === 'number' && typeof p.y === 'number' ? (
                        <text key={`${s.key}-end`} x={p.x + 8} y={p.y + 4} fontSize={12} fontWeight={600} fill="var(--ink)">
                          {s.label}
                        </text>
                      ) : (
                        <g key={`${s.key}-${p.index}`} />
                      )
                  : undefined
              }
            />
          );
        })}
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
            fillOpacity={s.style?.opacity ?? 1}
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
