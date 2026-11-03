'use client';

import { useId } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ToggleChip } from '@/components/ui/ToggleChip';
import type { ChartKind, ChartKindOption } from '@/lib/dataView';

const LABEL: Record<ChartKind, string> = { bar: 'Bar', line: 'Line', area: 'Area' };

/**
 * Bar | Line | Area (+ a "Stacked" chip while Bar is selected and there is more than one series). Plan §4.11.3 / §2.7.6.
 * Line and Area stay visible but unavailable under 4 data points; the reason is on the option and printed under the control.
 */
export function ChartTypeSwitch({
  options, kind, onKind, stacked, onStacked, multiSeries,
}: {
  options: ChartKindOption[];
  kind: ChartKind;
  onKind: (k: ChartKind) => void;
  stacked: boolean;
  onStacked: (s: boolean) => void;
  multiSeries: boolean;
}) {
  const reasonsId = useId();
  // One sentence per reason, repeated wording folded: "Line needs … Area needs …" reads as one caption under the whole row.
  const reasons = options.filter((o) => o.disabledReason).map((o) => o.disabledReason as string);
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex flex-wrap items-start gap-2">
        <SegmentedControl<ChartKind>
          size="sm"
          aria-label="Chart type"
          value={kind}
          onChange={onKind}
          showReasons={false}
          reasonsId={reasonsId}
          options={options.map((o) => ({ value: o.kind, label: LABEL[o.kind], disabledReason: o.disabledReason }))}
        />
        {kind === 'bar' && multiSeries && <ToggleChip label="Stacked" pressed={stacked} onPressedChange={onStacked} />}
      </div>
      {reasons.length > 0 && (
        <p id={reasonsId} className="dv-reason">
          {reasons.join(' ')}
        </p>
      )}
    </div>
  );
}
