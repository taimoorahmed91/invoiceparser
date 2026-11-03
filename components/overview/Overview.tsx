'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileUp } from 'lucide-react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useUpload } from '@/components/upload/UploadProvider';
import { useInvoices } from '@/hooks/useInvoices';
import { useManualValues } from '@/hooks/useManualValues';
import { buildBreakdown, buildKpis, dataMonthsYm, overviewRangeSpec, parseOverviewRange, resolvePeriod, type OverviewRange } from '@/lib/analyticsOverview';
import type { YearMonth } from '@/lib/analyticsMonthly';
import type { StoredInvoice } from '@/lib/storage';
import { KpiCards } from './KpiCards';
import { ItemBreakdown } from './ItemBreakdown';
import { LatestInvoices } from './LatestInvoices';
import { OverviewReportButton } from './OverviewReportButton';
import { PeriodSwitcher } from './PeriodSwitcher';

// Recharts is the heaviest client dependency: only loaded here and on Analytics (plan §6.3).
const MonthlyCostsCard = dynamic(() => import('./MonthlyCostsCard'), {
  ssr: false,
  loading: () => <Skeleton height={460} label="Loading chart" />,
});

/** The first-load stagger plays once per page load, not every time Overview is opened (plan §2.6 rule 1). */
let staggerPlayed = false;

function Loading() {
  return (
    <div className="ov-page" aria-busy="true">
      <Skeleton height={64} label="Loading period" />
      <div className="ov-skel-grid">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={146} label="Loading figure" />
        ))}
      </div>
      <div className="ov-main">
        <Skeleton height={510} label="Loading chart" />
        <Skeleton height={510} label="Loading items" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={56} label="Loading invoice" />
        ))}
      </div>
    </div>
  );
}

function Content({ invoices, manualValues }: { invoices: StoredInvoice[]; manualValues: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [stagger] = useState(() => !staggerPlayed);
  useEffect(() => {
    staggerPlayed = true;
  }, []);

  const yms = useMemo(() => dataMonthsYm(invoices), [invoices]);
  const period = resolvePeriod(params.get('period'), yms) as YearMonth;
  const range = parseOverviewRange(params.get('range'));

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const latest = yms[yms.length - 1];
  const onPeriod = useCallback((ym: YearMonth) => update({ period: ym === latest ? null : ym }), [update, latest]);
  const onRange = useCallback((r: OverviewRange) => update({ range: r === '12m' ? null : r }), [update]);

  const kpis = useMemo(() => buildKpis(invoices, period), [invoices, period]);
  const breakdown = useMemo(() => buildBreakdown(invoices, period, manualValues), [invoices, period, manualValues]);
  const reportOptions = useMemo(() => ({ period, range: overviewRangeSpec(range), manualValues }), [period, range, manualValues]);

  return (
    <div className={stagger ? 'ov-page ov-stagger' : 'ov-page'}>
      <div className="ov-head">
        <PeriodSwitcher yms={yms} period={period} onChange={onPeriod} />
        <div className="ov-report">
          <OverviewReportButton invoices={invoices} options={reportOptions} />
        </div>
      </div>
      {kpis && <KpiCards kpis={kpis} />}
      <div className="ov-main">
        <MonthlyCostsCard invoices={invoices} range={range} onRange={onRange} period={period} onPeriod={onPeriod} />
        {breakdown && <ItemBreakdown data={breakdown} />}
      </div>
      <LatestInvoices invoices={invoices} />
      <p className="sr-only-text" role="status" aria-live="polite">
        {kpis ? `Showing ${kpis.month}` : ''}
      </p>
    </div>
  );
}

export function Overview() {
  const { status, invoices, error, reload } = useInvoices();
  const upload = useUpload();
  const manual = useManualValues();

  if (status === 'error') {
    return (
      <Banner action={<Button variant="secondary" onClick={() => void reload()}>Retry</Button>}>
        Couldn’t load your invoices from the database. Your data is not lost. {error ? <span className="text-ink-muted">({error})</span> : null}
      </Banner>
    );
  }
  if (status === 'loading') return <Loading />;
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileUp}
        title="No invoices yet"
        action={
          <div className="flex flex-col items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => upload.open()}>
              Upload PDFs
            </Button>
            <Button variant="link" href="/data#import-export">
              Import a JSON backup
            </Button>
          </div>
        }
      >
        Upload the PDF invoices from your landlord. Rent, parking, water, heating, electricity and waste are picked up automatically.
      </EmptyState>
    );
  }
  return <Content invoices={invoices} manualValues={manual.values} />;
}

