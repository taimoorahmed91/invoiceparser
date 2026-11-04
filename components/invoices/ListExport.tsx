'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, FileText, Printer, Sheet, Braces, Table2 } from 'lucide-react';
import { MenuButton } from '@/components/ui/MenuButton';
import { useToast } from '@/components/toast/ToastProvider';
import { buildExport } from '@/lib/dataExport';
import { buildInvoiceListReport } from '@/lib/dataReport';
import { downloadText } from '@/lib/download';
import type { StoredInvoice } from '@/lib/storage';

// The print tree draws charts with Recharts; load it only when a PDF is asked for.
const ReportHost = dynamic(() => import('@/components/print/ReportHost').then((m) => m.ReportHost), { ssr: false });

/**
 * Export menu of the Invoices page (plan §4.3, F39–F42): JSON (all invoices), CSV and Excel-compatible of the current list, PDF of the current list,
 * and Print list. The files are the same ones the old File / Export menus wrote (names, types, text), adjustments applied.
 */
export function ListExport({ all, rows, manualValues, filtersText }: { all: StoredInvoice[]; rows: StoredInvoice[]; manualValues: Record<string, number>; filtersText: string }) {
  const toast = useToast();
  const [pdf, setPdf] = useState(false);
  const none = rows.length === 0 ? 'There are no invoices in this list' : undefined;

  const download = (kind: 'json' | 'csv' | 'xls') => {
    const file = buildExport(kind, kind === 'json' ? all : rows, manualValues);
    downloadText(file.content, file.filename, file.mime);
    toast.success(`Downloaded ${file.filename}`);
  };

  const report = useMemo(() => (pdf ? buildInvoiceListReport(rows, manualValues, filtersText) : null), [pdf, rows, manualValues, filtersText]);
  const done = useCallback(
    (error?: Error) => {
      setPdf(false);
      if (error) toast.error(`Couldn’t create the PDF: ${error.message}`);
    },
    [toast],
  );

  return (
    <>
      <MenuButton
        label="Export"
        icon={Download}
        align="end"
        entries={[
          { type: 'group', label: 'Heating adjustments from manual values are included.' },
          { label: 'JSON (all invoices)', icon: Braces, description: 'Every invoice with its line items', disabledReason: all.length === 0 ? 'There are no invoices yet' : undefined, onSelect: () => download('json') },
          { label: 'CSV (current list)', icon: Table2, description: 'The invoices shown, in the order shown', disabledReason: none, onSelect: () => download('csv') },
          { label: 'Excel-compatible (.xls, current list)', icon: Sheet, description: 'The same summary saved as .xls', disabledReason: none, onSelect: () => download('xls') },
          { label: 'PDF (current list)', icon: FileText, description: 'Opens the print dialog: choose “Save as PDF”', disabledReason: none, onSelect: () => setPdf(true) },
          { type: 'separator' },
          { label: 'Print list…', icon: Printer, description: 'Prints this page as it is', onSelect: () => window.print() },
        ]}
      />
      {report && <ReportHost data={report} onDone={done} />}
    </>
  );
}
