'use client';

import Link from 'next/link';
import { CalendarRange, House, Wallet, Zap, type LucideIcon } from 'lucide-react';
import { RollingNumber } from '@/components/ui/RollingNumber';
import { describeCompare, type Kpi, type KpiId, type OverviewKpis } from '@/lib/analyticsOverview';
import { fmtMoney } from '@/lib/format';
import { kpiLink, storeLegacyFilters } from '@/lib/overviewLinks';

const ICONS: Record<KpiId, LucideIcon> = { total: Wallet, 'rent-parking': House, utility: Zap, ytd: CalendarRange };

/**
 * One KPI card. The whole card is a link to the Invoices view it counts (plan §4.2). The value and the change line roll when they
 * change (period switch, new data); on first render they are simply there. Colour only supports the arrow and the sign in the text.
 */
function KpiCard({ kpi, period, index }: { kpi: Kpi; period: string; index: number }) {
  const Icon = ICONS[kpi.id];
  const d = describeCompare(kpi.compare);
  const link = kpiLink(kpi.id, period);
  const context = [d.against, kpi.sub].filter(Boolean).join(' · ');
  return (
    <Link href={link.href} className="ov-kpi ov-enter" style={{ '--i': index } as React.CSSProperties} data-kpi={kpi.id} onClick={() => storeLegacyFilters(link.filters)}>
      <span className="ov-kpi-top">
        <span className="ov-kpi-label">{kpi.label}</span>
        <span className="ov-kpi-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.75} />
        </span>
      </span>
      <span className="ov-kpi-value">
        <RollingNumber value={fmtMoney(kpi.value)} />
      </span>
      <span className="ov-kpi-delta" data-dir={d.direction}>
        {d.direction === 'none' ? (
          d.text
        ) : (
          // amount and percentage are separate so a narrow card wraps between them, never inside a number
          d.parts.map((part, i) => (
            <span key={i} className="ov-kpi-part">
              <RollingNumber value={i < d.parts.length - 1 ? `${part} ·` : part} />
            </span>
          ))
        )}
      </span>
      <span className="ov-kpi-ctx">{context || '\u00a0'}</span>
    </Link>
  );
}

export function KpiCards({ kpis }: { kpis: OverviewKpis }) {
  return (
    <section className="ov-kpis" aria-label={`Key figures for ${kpis.month}`}>
      {kpis.cards.map((k, i) => (
        <KpiCard key={k.id} kpi={k} period={kpis.period} index={i} />
      ))}
    </section>
  );
}
