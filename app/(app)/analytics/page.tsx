'use client';

import { Suspense, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileUp } from 'lucide-react';
import { AnalyticsTabs, parseTab, type AnalyticsTab } from '@/components/analytics/AnalyticsTabs';
import { RangeControl } from '@/components/analytics/RangeControl';
import { ReportMenu } from '@/components/analytics/ReportMenu';
import type { MonthlyLayout } from '@/components/analytics/MonthlyCostsTab';
import { parseMetric, type UtilityMetricKey } from '@/lib/analyticsUtilities';
import { parseYoyType, type YoyType } from '@/lib/analyticsYoy';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useInvoices } from '@/hooks/useInvoices';
import { monthsWithData, parseRange, resolveRange, serializeRange, type RangeSpec } from '@/lib/analyticsMonthly';

// Recharts is the heaviest client dependency: only this tab loads it (plan §6.3).
const YoyTab = dynamic(() => import('@/components/analytics/YoyTab'), {
  ssr: false,
  loading: () => <Skeleton height={460} label="Loading charts" />,
});
const UtilitiesTab = dynamic(() => import('@/components/analytics/UtilitiesTab'), {
  ssr: false,
  loading: () => <Skeleton height={460} label="Loading charts" />,
});
const MonthlyCostsTab = dynamic(() => import('@/components/analytics/MonthlyCostsTab'), {
  ssr: false,
  loading: () => <Skeleton height={460} label="Loading charts" />,
});

function AnalyticsInner() {
  const { status, invoices, error, reload } = useInvoices();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const tab = parseTab(params.get('tab'));
  const range = useMemo(() => parseRange(params.get('range')), [params]);
  const layout: MonthlyLayout = params.get('layout') === 'separate' ? 'separate' : 'stacked';
  const metric: UtilityMetricKey = parseMetric(params.get('metric'));
  const yoyType: YoyType = parseYoyType(params.get('type'));

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const reportOptions = useMemo(() => ({ tab, range, metric, yoyType }), [tab, range, metric, yoyType]);
  const dataMonths = useMemo(() => monthsWithData(invoices), [invoices]);
  const span = useMemo(() => resolveRange(range, dataMonths), [range, dataMonths]);

  if (status === 'error') {
    return (
      <Banner action={<Button variant="secondary" onClick={() => void reload()}>Retry</Button>}>
        Couldn’t load your invoices from the database. Your data is not lost. {error ? <span className="text-ink-muted">({error})</span> : null}
      </Banner>
    );
  }
  if (status === 'loading') return <Skeleton height={520} label="Loading invoices" />;
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileUp}
        title="No invoices yet"
        action={
          <Button variant="primary" size="lg" href="/invoices">
            Go to Invoices to upload
          </Button>
        }
      >
        Upload your PDF invoices first. Rent, parking and utilities are picked up automatically and show up here.
      </EmptyState>
    );
  }

  return (
    <div className="an-page">
      <div className="an-controls">
        <AnalyticsTabs value={tab} onChange={(t: AnalyticsTab) => update({ tab: t })} />
        {tab !== 'yoy' && <RangeControl range={range} dataMonths={dataMonths} span={span} onChange={(r: RangeSpec) => update({ range: serializeRange(r) })} />}
        <div className="an-report">
          <ReportMenu invoices={invoices} options={reportOptions} />
        </div>
        <p className="an-caption">{tab === 'yoy' ? 'Year over year always compares all your invoices, so the range does not apply here.' : 'Charts use all invoices in the selected range.'}</p>
      </div>
      <div role="tabpanel" id={`analytics-panel-${tab}`} aria-labelledby={`analytics-tab-${tab}`}>
        {tab === 'yoy' ? (
          <YoyTab invoices={invoices} type={yoyType} onType={(t) => update({ type: t === 'utility' ? null : t })} />
        ) : tab === 'utilities' ? (
          <UtilitiesTab
            invoices={invoices}
            range={range}
            metric={metric}
            onMetric={(m) => update({ metric: m === 'cost' ? null : m })}
            onResetRange={() => update({ range: 'all' })}
          />
        ) : (
          <MonthlyCostsTab
            invoices={invoices}
            range={range}
            layout={layout}
            onLayout={(l) => update({ layout: l === 'stacked' ? null : l })}
            onResetRange={() => update({ range: 'all' })}
          />
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<Skeleton height={520} label="Loading" />}>
      <AnalyticsInner />
    </Suspense>
  );
}
