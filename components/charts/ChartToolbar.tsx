'use client';

import { forwardRef, useRef, type ReactNode } from 'react';
import { Ellipsis, Maximize2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MenuButton, type MenuEntry } from '@/components/ui/MenuButton';
import { ExportMenu } from './ExportMenu';
import { ViewSwitch } from './ViewSwitch';
import { ChartTypeSwitch } from './ChartTypeSwitch';
import type { DataViewState } from '@/hooks/useDataView';

interface ChartToolbarProps {
  title: string;
  subtitle?: string;
  /** Optional live figure under the subtitle (e.g. latest value and change). Screen only. */
  summary?: ReactNode;
  /** Decorative icon before the title (neutral colour; series colours are for chart fills only). */
  icon?: LucideIcon;
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
  /** Extra control in the second row, after Chart | Table and the chart type (e.g. the Overview range 6M · 12M · All). */
  viewExtra?: ReactNode;
}

/**
 * The one toolbar every chart and table has (plan §4.11.1).
 * ≥ 640 px: title left, [Full screen] [Export ▾] right, second row Chart | Table · Bar | Line | Area · Stacked.
 * < 640 px: title + one labelled "More ▾" menu (Full screen, Export …); both switches take the full row (§2.7.9).
 */
export const ChartToolbar = forwardRef<HTMLButtonElement, ChartToolbarProps>(function ChartToolbar(
  { title, subtitle, summary, icon: TitleIcon, headingLevel = 2, state, hasChart, multiSeries, chartDisabledReason, exportEntries, showExpand = true, showViewSwitch = true, onExpand, trailing, viewExtra },
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
          <Heading className="dv-title">
            {TitleIcon && <TitleIcon size={18} strokeWidth={1.75} aria-hidden="true" className="dv-title-icon" />}
            {title}
          </Heading>
          {subtitle && <p className="dv-sub">{subtitle}</p>}
          {summary && <div className="dv-summary">{summary}</div>}
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
      {(showViewSwitch || showTypes || viewExtra) && (
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
          {viewExtra}
        </div>
      )}
    </div>
  );
});
