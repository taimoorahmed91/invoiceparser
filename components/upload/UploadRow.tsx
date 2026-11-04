'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Ban, CircleCheck, CircleX, Clock, Copy, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { fmtMoney } from '@/lib/format';
import { invoiceLink } from '@/lib/overviewLinks';
import type { UploadItem } from '@/lib/uploader';
import type { StoredInvoice } from '@/lib/storage';

/** The words for a row's status. Every status also has its own icon, so colour is never the only signal. */
export function statusLabel(item: UploadItem): string {
  switch (item.status) {
    case 'waiting': return 'Waiting';
    case 'reading': return 'Reading…';
    case 'saving': return 'Saving…';
    case 'saved': return item.warnings.length > 0 ? 'Saved — check this one' : 'Saved';
    case 'duplicate': return 'Already saved';
    case 'failed': return item.stage === 'save' ? 'Couldn’t save' : 'Couldn’t read this file';
    case 'skipped': return 'Skipped — not a PDF';
  }
}

function StatusIcon({ item }: { item: UploadItem }) {
  const p = { size: 18, strokeWidth: 1.75, 'aria-hidden': true } as const;
  switch (item.status) {
    case 'waiting': return <Clock {...p} />;
    case 'reading':
    case 'saving': return <Spinner size={18} />;
    case 'saved': return item.warnings.length > 0 ? <TriangleAlert {...p} /> : <CircleCheck {...p} />;
    case 'duplicate': return <Copy {...p} />;
    case 'failed': return <CircleX {...p} />;
    case 'skipped': return <Ban {...p} />;
  }
}

/** One file of the queue: icon + text status, the invoice it became, what to check, and the actions that make sense for that state. */
export function UploadRow({
  item, stored, onRetry, onNavigate,
}: {
  item: UploadItem;
  /** The invoice already in the list that this file duplicates (for the Open link). */
  stored?: StoredInvoice;
  onRetry: (id: string) => void;
  /** Called when a link inside the row is followed, so the dialog can close. */
  onNavigate: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const detailsId = useId();
  const warn = item.status === 'saved' && item.warnings.length > 0;

  let detail = '';
  if (item.status === 'saved' && item.invoice) {
    detail = `${item.invoice.invoiceNumber} · ${fmtMoney(item.invoice.totals.grossTotal, item.invoice.currency || 'PLN')}`;
  } else if (item.status === 'duplicate' && item.duplicateOf) {
    detail = item.duplicateOf.where === 'saved' ? `(${item.duplicateOf.invoiceNumber})` : `(${item.duplicateOf.invoiceNumber}) — same as ${item.duplicateOf.fileName ?? 'an earlier file'} in this upload`;
  }

  const open = (target: StoredInvoice | undefined) => {
    if (!target) return null;
    const link = invoiceLink(target);
    return (
      <Link href={link.href} className="btn-link" onClick={onNavigate}>
        {item.status === 'duplicate' ? 'Open' : 'Review'}
        <span className="sr-only-text"> {target.invoice.invoiceNumber}</span>
      </Link>
    );
  };

  return (
    <li className="up-row" data-status={item.status} data-warn={warn ? 'true' : undefined}>
      <span className="up-icon"><StatusIcon item={item} /></span>
      <div className="up-main">
        <p className="up-name" title={item.name}>{item.name}</p>
        <p className="up-status">
          <strong>{statusLabel(item)}</strong>
          {detail && <> · {detail}</>}
        </p>
        {warn && (
          <ul className="up-warn" aria-label="Things to check">
            {item.warnings.map((w) => <li key={w.code}>{w.message}</li>)}
          </ul>
        )}
        {item.status === 'failed' && showDetails && (
          <p id={detailsId} className="up-details">{item.error ?? 'No more information.'}</p>
        )}
      </div>
      <div className="up-actions">
        {item.status === 'duplicate' && item.duplicateOf?.where === 'saved' && open(stored)}
        {warn && open(item.row)}
        {item.status === 'failed' && (
          <>
            <Button variant="link" aria-expanded={showDetails} aria-controls={detailsId} onClick={() => setShowDetails((v) => !v)}>
              Details<span className="sr-only-text"> for {item.name}</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onRetry(item.id)}>
              Retry<span className="sr-only-text"> {item.name}</span>
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
