'use client';

import { useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import type { YearMonth } from '@/lib/analyticsMonthly';
import { ymToMonthKey } from '@/lib/analyticsMonthly';
import { detectPreset, presetRange, type PeriodPreset } from '@/lib/invoiceList';

/**
 * The Period choices (plan §4.3): All time · This year · Last 12 months · Custom, and for Custom two selects built from the months that
 * have invoices. Choosing the same month in both is the old "Month" filter. Everything applies at once.
 */
export function PeriodControls({
  from, to, dataMonths, onChange, idPrefix, asSelect,
}: {
  from: string;
  to: string;
  dataMonths: YearMonth[];
  onChange: (range: { from: string; to: string }) => void;
  idPrefix: string;
  /** Phones: the four presets do not fit in one row at 375 px, so they become a Select (plan §2.7.6 "collapseBelow"). */
  asSelect?: boolean;
}) {
  // "Custom" must stay selected (and keep showing From / To) even when the range happens to equal a preset, e.g. right after
  // picking Last 12 months and then Custom. So it is remembered here instead of being worked out from the dates alone.
  const [customOn, setCustomOn] = useState(false);
  const detected = detectPreset(from, to, dataMonths);
  const preset: PeriodPreset = customOn && (from || to) ? 'custom' : detected;
  useEffect(() => {
    if (!from && !to) setCustomOn(false); // Clear all / the chip's ✕
  }, [from, to]);
  const first = dataMonths[0] ?? '';
  const last = dataMonths[dataMonths.length - 1] ?? '';
  const none = dataMonths.length === 0 ? 'No invoices yet' : undefined;
  // the selects always show something real: an open end shows the first / last month with data
  const fromValue = from || first;
  const toValue = to || last;

  const choose = (p: PeriodPreset) => {
    setCustomOn(p === 'custom');
    if (p === 'custom') onChange({ from: from || first, to: to || last });
    else onChange(presetRange(p, dataMonths));
  };

  return (
    <div className="inv-period">
      {asSelect ? (
        <Select id={`${idPrefix}-preset`} label="Show" size="md" value={preset} onChange={(e) => choose(e.target.value as PeriodPreset)}>
          <option value="all">All time</option>
          <option value="year" disabled={!!none}>This year</option>
          <option value="last12" disabled={!!none}>Last 12 months</option>
          <option value="custom" disabled={!!none}>Custom range</option>
        </Select>
      ) : (
        <SegmentedControl<PeriodPreset>
          aria-label="Period"
          size="md"
          value={preset}
          onChange={choose}
          options={[
            { value: 'all', label: 'All time' },
            { value: 'year', label: 'This year', disabledReason: none },
            { value: 'last12', label: 'Last 12 months', disabledReason: none },
            { value: 'custom', label: 'Custom', disabledReason: none },
          ]}
          showReasons={false}
        />
      )}
      {preset === 'custom' && (
        <div className="inv-period-range">
          <Select id={`${idPrefix}-from`} label="From" size="md" value={fromValue} onChange={(e) => onChange({ from: e.target.value, to: e.target.value > toValue ? e.target.value : to || last })}>
            {dataMonths.map((ym) => (
              <option key={ym} value={ym}>{ymToMonthKey(ym)}</option>
            ))}
          </Select>
          <Select id={`${idPrefix}-to`} label="To" size="md" value={toValue} onChange={(e) => onChange({ from: e.target.value < fromValue ? e.target.value : from || first, to: e.target.value })}>
            {dataMonths.map((ym) => (
              <option key={ym} value={ym}>{ymToMonthKey(ym)}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
