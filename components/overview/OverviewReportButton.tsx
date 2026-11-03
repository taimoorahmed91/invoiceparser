'use client';

import { useCallback, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/toast/ToastProvider';
import dynamic from 'next/dynamic';
import { buildOverviewReport, type OverviewReportOptions } from '@/lib/analyticsReport';
import type { StoredInvoice } from '@/lib/storage';

// The print tree draws charts with Recharts; load it only when a report is asked for.
const ReportHost = dynamic(() => import('@/components/print/ReportHost').then((m) => m.ReportHost), { ssr: false });

/** "Report (PDF)": a one-page light report of this Overview snapshot (key figures, Monthly costs, this month by item). */
export function OverviewReportButton({ invoices, options }: { invoices: StoredInvoice[]; options: OverviewReportOptions }) {
  const toast = useToast();
  const [on, setOn] = useState(false);
  const data = useMemo(() => (on ? buildOverviewReport(invoices, options) : null), [on, invoices, options]);
  const done = useCallback(
    (error?: Error) => {
      setOn(false);
      if (error) toast.error(`Couldn't create the report: ${error.message}`);
    },
    [toast],
  );
  return (
    <>
      <Button variant="secondary" icon={FileText} disabledReason={on ? 'A report is being prepared' : undefined} onClick={() => setOn(true)}>
        Report (PDF)
      </Button>
      {data && <ReportHost data={data} onDone={done} />}
    </>
  );
}
