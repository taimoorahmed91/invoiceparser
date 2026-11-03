'use client';

import { useCallback, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { MenuButton } from '@/components/ui/MenuButton';
import { useToast } from '@/components/toast/ToastProvider';
import dynamic from 'next/dynamic';
import { TAB_TITLES, buildAnalyticsReport, type ReportOptions, type ReportScope } from '@/lib/analyticsReport';
import type { StoredInvoice } from '@/lib/storage';

// The print tree draws charts with Recharts; load it only when a report is asked for.
const ReportHost = dynamic(() => import('@/components/print/ReportHost').then((m) => m.ReportHost), { ssr: false });

/**
 * "Report (PDF)": This tab / All tabs (plan §4.12.4). Opens the browser print dialog on a purpose-built light document;
 * choose "Save as PDF".
 */
export function ReportMenu({ invoices, options }: { invoices: StoredInvoice[]; options: Omit<ReportOptions, 'scope'> }) {
  const toast = useToast();
  const [scope, setScope] = useState<ReportScope | null>(null);
  const data = useMemo(() => (scope ? buildAnalyticsReport(invoices, { ...options, scope }) : null), [scope, invoices, options]);
  const done = useCallback(
    (error?: Error) => {
      setScope(null);
      if (error) toast.error(`Couldn't create the report: ${error.message}`);
    },
    [toast],
  );
  const reason = invoices.length === 0 ? 'Nothing to report yet' : scope ? 'A report is being prepared' : undefined;
  return (
    <>
      <MenuButton
        label="Report (PDF)"
        icon={FileText}
        align="end"
        entries={[
          { label: `This tab (${TAB_TITLES[options.tab]})`, description: 'Its charts and table', disabledReason: reason, onSelect: () => setScope('tab') },
          { label: 'All tabs', description: 'Monthly costs, Utilities and Year over year, one page each', disabledReason: reason, onSelect: () => setScope('all') },
        ]}
      />
      {data && <ReportHost data={data} onDone={done} />}
    </>
  );
}
