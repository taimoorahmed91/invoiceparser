'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { monthKeyToYm, ymToMonthKey, type RangeSpec, type YearMonth } from '@/lib/analyticsMonthly';

type Choice = '6m' | '12m' | 'all' | 'custom';

function choiceOf(r: RangeSpec): Choice {
  if (r.kind === 'all') return 'all';
  if (r.kind === 'custom') return 'custom';
  return r.months === 6 ? '6m' : '12m';
}

/**
 * 6M · 12M · All · Custom (plan §4.7). Custom shows From / To selects built from the months that exist in the data.
 * `span` is the range currently in effect; it seeds the Custom selects.
 */
export function RangeControl({
  range, onChange, dataMonths, span,
}: {
  range: RangeSpec;
  onChange: (r: RangeSpec) => void;
  dataMonths: string[];
  span: { from: YearMonth; to: YearMonth } | null;
}) {
  const options = dataMonths.map((k) => ({ ym: monthKeyToYm(k) as YearMonth, key: k })).filter((o) => o.ym);
  const disabled = options.length === 0 ? 'No invoices yet' : undefined;
  const from = range.kind === 'custom' ? range.from : span?.from ?? options[0]?.ym ?? '';
  const to = range.kind === 'custom' ? range.to : span?.to ?? options[options.length - 1]?.ym ?? '';

  return (
    <div className="flex flex-wrap items-end gap-3">
      <SegmentedControl<Choice>
        aria-label="Range"
        size="md"
        value={choiceOf(range)}
        onChange={(c) => {
          if (c === '6m') onChange({ kind: 'last', months: 6 });
          else if (c === '12m') onChange({ kind: 'last', months: 12 });
          else if (c === 'all') onChange({ kind: 'all' });
          else if (span) onChange({ kind: 'custom', from: span.from, to: span.to });
        }}
        options={[
          { value: '6m', label: '6M', disabledReason: disabled },
          { value: '12m', label: '12M', disabledReason: disabled },
          { value: 'all', label: 'All', disabledReason: disabled },
          { value: 'custom', label: 'Custom', disabledReason: disabled },
        ]}
        showReasons={false}
      />
      {range.kind === 'custom' && (
        <div className="flex items-end gap-2">
          <Select label="From" size="md" value={from} onChange={(e) => onChange({ kind: 'custom', from: e.target.value, to: e.target.value > to ? e.target.value : to })}>
            {options.map((o) => (
              <option key={o.ym} value={o.ym}>{ymToMonthKey(o.ym)}</option>
            ))}
          </Select>
          <Select label="To" size="md" value={to} onChange={(e) => onChange({ kind: 'custom', from: e.target.value < from ? e.target.value : from, to: e.target.value })}>
            {options.map((o) => (
              <option key={o.ym} value={o.ym}>{ymToMonthKey(o.ym)}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}
