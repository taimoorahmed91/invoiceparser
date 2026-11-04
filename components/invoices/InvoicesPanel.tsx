'use client';

import { useMemo } from 'react';
import { DataPanel } from '@/components/charts/DataPanel';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { buildMonthlyRows } from '@/lib/analyticsMonthly';
import { monthlyStackedSpec } from '@/lib/analyticsSpecs';
import type { StoredInvoice } from '@/lib/storage';
import { invoiceListSpec } from '@/lib/invoiceList';
import { InvoiceCardList, InvoiceTable, type InvoiceListHandlers } from './InvoiceTable';

/**
 * The list as a DataPanel (plan §4.3 / §4.11): the invoice table is its Table view, so it gets Expand (full screen) and Export (CSV / PDF) like
 * every other table, and "Show as chart" draws the monthly totals of exactly the rows that are listed. Export reads the same rows, in the same order.
 */
export default function InvoicesPanel({ rows, h, range, filtersText }: { rows: StoredInvoice[]; h: InvoiceListHandlers; range: string; filtersText: string }) {
  const phone = useMediaQuery('(max-width: 639px)');
  const table = useMemo(() => invoiceListSpec(rows), [rows]);
  const chart = useMemo(() => monthlyStackedSpec(buildMonthlyRows(rows, { kind: 'all' }).rows), [rows]);
  return (
    <DataPanel
      title="Invoice list"
      subtitle={phone ? 'Tick two invoices to compare them.' : 'Tick two invoices to compare them. Arrow keys move between rows; Enter opens one.'}
      storageKey="invoices.list"
      table={table}
      chartSpec={chart}
      chartHeight={320}
      range={range}
      filters={filtersText}
      renderTable={({ fullscreen }) => (phone && !fullscreen ? <InvoiceCardList rows={rows} h={h} /> : <InvoiceTable rows={rows} h={h} scroll={fullscreen} />)}
    />
  );
}
