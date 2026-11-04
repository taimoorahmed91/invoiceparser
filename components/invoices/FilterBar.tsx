'use client';

import { forwardRef, useState } from 'react';
import { CalendarRange, SlidersHorizontal, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PopoverButton } from '@/components/ui/PopoverButton';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { RemovableChip, ToggleChip } from '@/components/ui/ToggleChip';
import { Search } from '@/components/ui/Search';
import { Dialog } from '@/components/overlay/Dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { YearMonth } from '@/lib/analyticsMonthly';
import type { Filters } from '@/lib/filters';
import { fmtMoney } from '@/lib/format';
import { INVOICE_TYPES, activeChips, periodLabel, type TypeCounts } from '@/lib/invoiceList';
import { PeriodControls } from './PeriodControls';

const TYPE_LABEL = { all: 'All', Rent: 'Rent', Parking: 'Parking', Utility: 'Utility', Other: 'Other' } as const;

function TypeChips({ filters, counts, onType }: { filters: Filters; counts: TypeCounts; onType: (t: Filters['filterType']) => void }) {
  const types: Array<Filters['filterType']> = ['all', ...INVOICE_TYPES.filter((t) => counts[t] > 0 || filters.filterType === t)];
  return (
    <div className="inv-types" role="group" aria-label="Invoice type">
      {types.map((t) => (
        <ToggleChip key={t} label={TYPE_LABEL[t]} count={counts[t]} pressed={filters.filterType === t} onPressedChange={(p) => onType(p ? t : 'all')} />
      ))}
    </div>
  );
}

/**
 * The sticky filter bar (plan §4.3): search, type chips with counts, Period, every active filter as a removable chip + Clear all,
 * and the result strip "Showing 9 of 26 · 11 204,10 zł" with Undo while there is something to undo.
 * On phones: search + a Filters (n) button that opens the type and period choices in a bottom sheet.
 */
export const FilterBar = forwardRef<HTMLInputElement, {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  clear: () => void;
  counts: TypeCounts;
  dataMonths: YearMonth[];
  shown: number;
  total: number;
  sum: number;
  canUndo: boolean;
  onUndo: () => void;
}>(function FilterBar({ filters, set, clear, counts, dataMonths, shown, total, sum, canUndo, onUndo }, searchRef) {
  const phone = useMediaQuery('(max-width: 639px)');
  const [sheet, setSheet] = useState(false);
  const chips = activeChips(filters);
  const period = periodLabel(filters.dateRangeStart, filters.dateRangeEnd);
  const filterCount = chips.filter((c) => c.key !== 'search').length;

  const periodControls = (prefix: string, asSelect = false) => (
    <PeriodControls asSelect={asSelect} from={filters.dateRangeStart} to={filters.dateRangeEnd} dataMonths={dataMonths} idPrefix={prefix} onChange={(r) => set({ dateRangeStart: r.from, dateRangeEnd: r.to })} />
  );

  return (
    <div className="inv-filterbar no-print" role="search" aria-label="Filter invoices">
      <div className="inv-filter-row">
        <Search
          ref={searchRef}
          className="inv-search"
          aria-label="Search invoices by number or file name"
          placeholder={phone ? 'Search number or file…' : 'Search number or file…  ( / )'}
          value={filters.searchQuery}
          onChange={(v) => set({ searchQuery: v })}
        />
        {phone ? (
          <>
            <Button variant="secondary" icon={SlidersHorizontal} onClick={() => setSheet(true)}>
              {filterCount > 0 ? `Filters (${filterCount})` : 'Filters'}
            </Button>
            {sheet && (
              <Dialog
                className="dlg-sheet"
                title="Filters"
                closeButton
                returnFocusTo={null}
                onClose={() => setSheet(false)}
                actions={
                  <>
                    <Button variant="ghost" disabledReason={chips.length === 0 ? 'No filters are on' : undefined} onClick={() => { clear(); }}>Clear all</Button>
                    <Button variant="primary" data-autofocus onClick={() => setSheet(false)}>{`Show ${shown} ${shown === 1 ? 'invoice' : 'invoices'}`}</Button>
                  </>
                }
              >
                <div className="inv-sheet">
                  <div className="inv-sheet-group">
                    <p className="inv-sheet-label" id="inv-sheet-type">Type</p>
                    <TypeChips filters={filters} counts={counts} onType={(t) => set({ filterType: t })} />
                  </div>
                  <div className="inv-sheet-group">
                    <p className="inv-sheet-label">Period</p>
                    {periodControls('sheet', true)}
                  </div>
                </div>
              </Dialog>
            )}
          </>
        ) : (
          <>
            <TypeChips filters={filters} counts={counts} onType={(t) => set({ filterType: t })} />
            <PopoverButton label={period ? `Period: ${period}` : 'Period: All time'} icon={CalendarRange} panelLabel="Period" className="inv-period-btn">
              {periodControls('pop')}
            </PopoverButton>
          </>
        )}
      </div>

      <div className="inv-strip-row">
        <div className="inv-chips" aria-label="Active filters">
          {chips.map((c) => (
            <RemovableChip key={c.key} label={c.label} onRemove={() => set(c.clear)} />
          ))}
          {chips.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear}>Clear all</Button>
          )}
        </div>
        <p className="inv-result" role="status">
          Showing {shown} of {total} · <RollingNumber value={fmtMoney(sum)} />
        </p>
        <span className="inv-undo-slot">
          {canUndo && (
            <Button variant="ghost" size="sm" icon={Undo2} onClick={onUndo}>Undo delete</Button>
          )}
        </span>
      </div>
    </div>
  );
});
