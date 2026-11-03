'use client';

import { useRef, useState, type KeyboardEvent, type MutableRefObject } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, useActiveTooltipLabel } from 'recharts';
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
  /**
   * Makes the chart pick a x value: a click or tap on a column, or Enter / Space on the column the arrow keys are on.
   * Called with the x value (e.g. "Nov 2026").
   */
  onSelect?: (x: string) => void;
  /** The x value that is currently picked; drawn as a soft band behind its column. */
  selected?: string | null;
  /**
   * Play the grow-in animation once for this key (per page load), then never again, so a filter or range change redraws without motion
   * (plan §2.6 rule 1). Without it the chart animates whenever it is drawn, as before.
   */
  animateOnce?: { key: string; durationMs?: number; delayMs?: number };
}

/** Keys whose first-draw animation has already played in this page load. */
const PLAYED = new Set<string>();

/** Remembers the label the arrow keys are on, so Enter can pick it. Must sit inside the chart. */
function LabelProbe({ store }: { store: MutableRefObject<string | null> }) {
  const label = useActiveTooltipLabel();
  store.current = label === undefined || label === null ? null : String(label);
  return null;
}

/**
 * Generic Bar (stacked / grouped) | Line | Area renderer driven by a TimeSeriesSpec. It is what the shared
 * toolbar draws today; Phase 4a adds the specialised bodies (StackedBars, SmallBars, YearLines) that plug into the same
 * ChartCard. Colours are tokens ("var(--rent)"), so the same chart is light inside the print tree and themed on screen.
 */
export function SeriesChart({ spec, chartType, height, width, interactive = true, yTick: yTickProp, onSelect, selected, animateOnce }: SeriesChartProps) {
  const yTick = yTickProp ?? spec.yTick ?? fmtCompactMoney;
  const reduced = useReducedMotion();
  const roomy = useMediaQuery('(min-width: 640px)');
  const [, rerender] = useState(0);
  const alreadyPlayed = animateOnce ? PLAYED.has(animateOnce.key) : false;
  const animate = interactive && !reduced && !alreadyPlayed;
  const motion = {
    isAnimationActive: animate,
    ...(animateOnce ? { animationDuration: animateOnce.durationMs ?? 450, animationBegin: animateOnce.delayMs ?? 0, animationEasing: 'ease-out' as const } : {}),
    onAnimationEnd: animateOnce
      ? () => {
          if (!PLAYED.has(animateOnce.key)) {
            PLAYED.add(animateOnce.key);
            rerender((n) => n + 1);
          }
        }
      : undefined,
  };
  const labelRef = useRef<string | null>(null);
  const pick = onSelect && interactive;
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
  const common = {
    data,
    margin: { top: totals ? 22 : 12, right: endLabels ? 44 : 12, left: 0, bottom: 4 },
    ...(pick
      ? {
          onClick: (state: { activeLabel?: string | number | null }) => {
            if (state?.activeLabel !== undefined && state.activeLabel !== null) onSelect(String(state.activeLabel));
          },
        }
      : {}),
  };
  const picked = selected && spec.rows.some((r) => r[spec.xKey] === selected) ? selected : null;

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
      {picked && <ReferenceArea x1={picked} x2={picked} ifOverflow="visible" fill="var(--ink)" fillOpacity={0.08} stroke="none" />}
      {interactive && <Tooltip content={<ChartTooltip spec={spec} />} cursor={{ fill: 'var(--surface-2)', opacity: 0.6 }} />}
      {pick && <LabelProbe store={labelRef} />}
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
              {...motion}
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
          <Area key={s.key} dataKey={s.key} name={s.label} stackId="a" stroke={s.color} fill={s.color} fillOpacity={0.35} strokeWidth={2} {...motion} />
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
            {...motion}
          />
        ))}
        {totals && (
          <Bar dataKey="__zero" stackId="a" fill="transparent" legendType="none" {...motion} activeBar={false}>
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
  const onKeyDown = pick
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        // arrow keys move the tooltip (Recharts accessibility layer); Enter or Space picks that column
        if ((e.key === 'Enter' || e.key === ' ') && labelRef.current) {
          e.preventDefault();
          onSelect(labelRef.current);
        }
      }
    : undefined;
  return (
    // initialDimension: the first render happens before the container is measured; without it Recharts logs a width(-1) warning.
    <div
      onKeyDown={onKeyDown}
      style={{ ...(pick ? { cursor: 'pointer' } : {}), ...(typeof height === 'string' ? { height } : {}) }}
      data-pickable={pick ? 'true' : undefined}
    >
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height: typeof height === 'number' ? height : 320 }}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
}
