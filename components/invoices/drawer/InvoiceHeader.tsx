'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { fmtDate } from '@/lib/format';
import type { Neighbours } from '@/lib/invoiceDetail';
import type { StoredInvoice } from '@/lib/storage';
import { TypeBadge } from '../TypeBadge';
import { CopyButton } from './CopyButton';

/**
 * Top of the drawer (plan §4.4): type badge, Prev / Next through the list as it is shown, Close; the number (the heading that names the
 * drawer), issue date and file name, and Copy for the number. Focus starts on the heading, so the next Tab reaches Prev.
 */
export function InvoiceHeader({
  stored, titleId, nav, onPrev, onNext, onClose,
}: {
  stored: StoredInvoice;
  titleId: string;
  nav: Neighbours;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const inv = stored.invoice;
  const hidden = nav.position === 0;
  const hiddenReason = 'This invoice is not in the list you are looking at (a filter hides it)';
  return (
    <>
      <div className="id-top">
        <TypeBadge invoice={stored} />
        <div className="id-nav" role="group" aria-label="Move through the list">
          <span className="id-pos" role="status">{hidden ? 'Hidden by filters' : `${nav.position} of ${nav.count}`}</span>
          <Button variant="secondary" size="sm" icon={ChevronLeft} disabledReason={hidden ? hiddenReason : nav.prevId ? undefined : 'This is the first invoice in the list'} onClick={onPrev}>Prev</Button>
          <Button variant="secondary" size="sm" iconEnd={ChevronRight} disabledReason={hidden ? hiddenReason : nav.nextId ? undefined : 'This is the last invoice in the list'} onClick={onNext}>Next</Button>
          <IconButton label="Close" icon={X} size="sm" onClick={onClose} />
        </div>
      </div>
      <div className="id-title-row">
        <h2 id={titleId} className="id-title" tabIndex={-1} data-autofocus>{inv.invoiceNumber}</h2>
        <CopyButton text={inv.invoiceNumber} what="invoice number" />
      </div>
      <p className="id-meta">
        <span>{inv.issueDate ? `Issued ${fmtDate(inv.issueDate)}` : 'No issue date'}</span>
        <span aria-hidden="true">·</span>
        <span className="id-file">{stored.filename}</span>
      </p>
    </>
  );
}
