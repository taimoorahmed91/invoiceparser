'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { longMonthLabel, neighbours } from '@/lib/analyticsOverview';
import type { YearMonth } from '@/lib/analyticsMonthly';

/**
 * ‹  November 2026 ▾  ›   [Latest]
 * Only months that have invoices can be picked; the arrows skip gaps. A native select keeps the OS picker on phones.
 */
export function PeriodSwitcher({ yms, period, onChange }: { yms: YearMonth[]; period: YearMonth; onChange: (ym: YearMonth) => void }) {
  const { prev, next } = neighbours(yms, period);
  const latest = yms[yms.length - 1];
  return (
    <div className="ov-period" role="group" aria-label="Period">
      <IconButton
        label="Previous month"
        icon={ChevronLeft}
        variant="secondary"
        disabledReason={prev ? undefined : 'No earlier month with invoices'}
        onClick={() => prev && onChange(prev)}
      />
      <Select label="Period" value={period} onChange={(e) => onChange(e.target.value)} wrapperClassName="ov-period-select">
        {[...yms].reverse().map((ym) => (
          <option key={ym} value={ym}>
            {longMonthLabel(ym)}
          </option>
        ))}
      </Select>
      <IconButton
        label="Next month"
        icon={ChevronRight}
        variant="secondary"
        disabledReason={next ? undefined : 'No later month with invoices'}
        onClick={() => next && onChange(next)}
      />
      <Button variant="ghost" disabledReason={period === latest ? 'Already showing the latest month' : undefined} onClick={() => onChange(latest)}>
        Latest
      </Button>
    </div>
  );
}
