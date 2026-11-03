'use client';

import { forwardRef, useRef, type ReactNode } from 'react';
import { Ellipsis, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MenuButton, type MenuEntry } from '@/components/ui/MenuButton';
import { ExportMenu } from './ExportMenu';
import { ViewSwitch } from './ViewSwitch';
import { ChartTypeSwitch } from './ChartTypeSwitch';
import type { DataViewState } from '@/hooks/useDataView';

interface ChartToolbarProps {
  title: string;
  subtitle?: string;
  headingLevel?: 2 | 3;
  state: Pick<DataViewState, 'view' | 'setView' | 'kindOptions' | 'chartKind' | 'setChartKind' | 'barStacked' | 'setBarStacked'>;
  hasChart: boolean;
  multiSeries: boolean;
  chartDisabledReason?: string;
  exportEntries: MenuEntry[];
  /** Hide Expand (inside the full-screen dialog). */
  showExpand?: boolean;
  /** Hide Chart | Table (the full-screen dialog shows both at once). */
  showViewSwitch?: boolean;
  onExpand?: (origin: HTMLElement | null) => void;
  /** Extra controls (close button in the dialog). */
  trailing?: ReactNode;
}

/**
 * The one toolbar every chart and table has (plan §4.11.1).
 * ≥ 640 px: title left, [Full screen] [Export ▾] right, second row Chart | Table · Bar | Line | Area · Stacked.
 * < 640 px: title + one labelled "More ▾" menu (Full screen, Export …); both switches take the full row (§2.7.9).
 */
export const ChartToolbar = forwardRef<HTMLButtonElement, ChartToolbarProps>(function ChartToolbar(
  { title, subtitle, headingLevel = 2, state, hasChart, multiSeries, chartDisabledReason, exportEntries, showExpand = true, showViewSwitch = true, onExpand, trailing },
  expandRef,
) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const moreWrap = useRef<HTMLDivElement>(null);
  const showTypes = hasChart && state.view === 'chart' && state.kindOptions.length > 1;

  const moreEntries: MenuEntry[] = [
    ...(showExpand ? ([{ label: 'Full screen', icon: Maximize2, onSelect: () => onExpand?.(moreWrap.current?.querySelector('button') ?? null) }, { type: 'separator' }] as MenuEntry[]) : []),
    ...exportEntries,
  ];

  return (
    <div className="dv-toolbar" role="group" aria-label={`${title}, controls`}>
      <div className="dv-head">
        <div className="min-w-0">
          <Heading className="dv-title">{title}</Heading>
          {subtitle && <p className="dv-sub">{subtitle}</p>}
        </div>
        <div className="dv-actions">
          <div className="dv-actions-wide">
            {showExpand && (
              <Button ref={expandRef} variant="secondary" size="sm" icon={Maximize2} onClick={(e) => onExpand?.(e.currentTarget)}>
                Full screen
              </Button>
            )}
            <ExportMenu entries={exportEntries} />
          </div>
          <div className="dv-actions-narrow" ref={moreWrap}>
            <MenuButton label="More" icon={Ellipsis} size="sm" align="end" entries={moreEntries} />
          </div>
          {trailing}
        </div>
      </div>
      {(showViewSwitch || showTypes) && (
        <div className="dv-view">
          {showViewSwitch && <ViewSwitch value={state.view} onChange={state.setView} chartDisabledReason={hasChart ? undefined : chartDisabledReason ?? 'This table has no time-series view'} />}
          {showTypes && (
            <ChartTypeSwitch
              options={state.kindOptions}
              kind={state.chartKind}
              onKind={state.setChartKind}
              stacked={state.barStacked}
              onStacked={state.setBarStacked}
              multiSeries={multiSeries}
            />
          )}
        </div>
      )}
    </div>
  );
});
