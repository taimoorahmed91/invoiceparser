'use client';

import { useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { ChartCard } from '@/components/charts/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { buildYoy, buildYoySpec, YOY_META, YOY_TYPES, type YoyType } from '@/lib/analyticsYoy';
import { fmtDelta, fmtMoney } from '@/lib/format';
import type { StoredInvoice } from '@/lib/storage';

/**
 * Analytics → Year over year (plan §4.7 tab 3): one line per year for the same calendar months, in the colour of the chosen
 * type, fading with age. Type select: Utility (default) · Rent · Parking · Total. Years with fewer than 4 months show dots only.
 * Always uses every invoice: a 6- or 12-month range would remove the very months that are being compared.
 */
export default function YoyTab({ invoices, type, onType }: { invoices: StoredInvoice[]; type: YoyType; onType: (t: YoyType) => void }) {
  const result = useMemo(() => buildYoy(invoices, type), [invoices, type]);
  const spec = useMemo(() => buildYoySpec(result, type, { value: (n) => fmtMoney(n), delta: (c, p) => fmtDelta(c, p).text }), [result, type]);
  const label = YOY_META[type].label;
  const firstYear = result.years[0];
  const lastYear = result.years[result.years.length - 1];

  const picker = (
    <Select label="Compare" size="md" value={type} onChange={(e) => onType(e.target.value as YoyType)} wrapperClassName="w-[200px]" helper="Gross cost per month">
      {YOY_TYPES.map((t) => (
        <option key={t} value={t}>{YOY_META[t].label}</option>
      ))}
    </Select>
  );

  if (result.overlapMonths === 0) {
    return (
      <div className="flex flex-col gap-4">
        {picker}
        <EmptyState icon={CalendarRange} title="Not enough years yet">
          Year-over-year needs the same month in two different years.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {picker}
      <ChartCard
        spec={spec}
        title={`${label} cost, year over year`}
        subtitle={`${firstYear} – ${lastYear} · the same months side by side · gross, zł`}
        storageKey={`analytics.yoy.${type}`}
        chartHeight={340}
        range={`${firstYear} – ${lastYear}`}
        filters="none (all invoices, all years)"
      />
    </div>
  );
}
