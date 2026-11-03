'use client';

import { useId } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ViewMode } from '@/lib/dataView';

/** Chart | Table. Always visible and always labelled (F49). Chart is unavailable, with a reason, for tables that have no time-series view. */
export function ViewSwitch({ value, onChange, chartDisabledReason }: { value: ViewMode; onChange: (v: ViewMode) => void; chartDisabledReason?: string }) {
  const reasonsId = useId();
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <SegmentedControl<ViewMode>
        size="sm"
        aria-label="View"
        value={value}
        onChange={onChange}
        showReasons={false}
        reasonsId={reasonsId}
        options={[
          { value: 'chart', label: 'Chart', icon: BarChart3, disabledReason: chartDisabledReason },
          { value: 'table', label: 'Table', icon: Table2 },
        ]}
      />
      {chartDisabledReason && (
        <p id={reasonsId} className="dv-reason">
          {chartDisabledReason}
        </p>
      )}
    </div>
  );
}
