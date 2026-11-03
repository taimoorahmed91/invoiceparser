'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/toast/ToastProvider';
import { useInvoices } from '@/hooks/useInvoices';
import { useManualValues } from '@/hooks/useManualValues';
import { buildExport, EXPORT_OPTIONS, type ExportKind } from '@/lib/dataExport';
import { buildDataReport } from '@/lib/dataReport';
import { downloadText } from '@/lib/download';

// The print tree draws charts with Recharts; load it only when a PDF is asked for.
const ReportHost = dynamic(() => import('@/components/print/ReportHost').then((m) => m.ReportHost), { ssr: false });

/**
 * Export the whole list (plan §4.8 item 2): JSON, CSV, Excel-compatible and PDF. Heating adjustments from manual values are included,
 * exactly like the old toolbar's exports; the file text comes from lib/export.ts.
 */
export function ExportPanel() {
  const { invoices } = useInvoices();
  const { values } = useManualValues();
  const toast = useToast();
  const [pdf, setPdf] = useState(false);
  const empty = invoices.length === 0 ? 'There are no invoices to export yet' : undefined;

  const download = (kind: ExportKind) => {
    const file = buildExport(kind, invoices, values);
    downloadText(file.content, file.filename, file.mime);
    toast.success(`Downloaded ${file.filename}`);
  };

  const report = useMemo(() => (pdf ? buildDataReport(invoices, values) : null), [pdf, invoices, values]);
  const onPdfDone = useCallback(
    (error?: Error) => {
      setPdf(false);
      if (error) toast.error(`Couldn’t create the PDF: ${error.message}`);
    },
    [toast],
  );

  return (
    <div className="dt-group">
      <div>
        <h3 className="dt-sub">Export</h3>
        <p className="dt-desc">All {invoices.length} invoices. Heating adjustments from manual values are included.</p>
      </div>
      <ul className="dt-rows">
        {EXPORT_OPTIONS.map((o) => (
          <li key={o.kind}>
            <div className="dt-row-text">
              <p className="dt-row-name">{o.label}</p>
              <p className="dt-row-desc">{o.description}</p>
            </div>
            <Button variant="secondary" icon={Download} disabledReason={empty} onClick={() => download(o.kind)}>
              <span className="sr-only-text">Download </span>{o.label}
            </Button>
          </li>
        ))}
        <li>
          <div className="dt-row-text">
            <p className="dt-row-name">PDF</p>
            <p className="dt-row-desc">A printable report: every invoice, then the manual heating values on their own page. Opens the print dialog; choose “Save as PDF”.</p>
          </div>
          <Button variant="secondary" icon={FileText} disabledReason={empty ?? (pdf ? 'A PDF is being prepared' : undefined)} onClick={() => setPdf(true)}>
            <span className="sr-only-text">Create </span>PDF
          </Button>
        </li>
      </ul>
      {report && <ReportHost data={report} onDone={onPdfDone} />}
    </div>
  );
}
