'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import InvoiceCard from '@/components/InvoiceCard';
import { Dialog } from '@/components/overlay/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useManualValues } from '@/hooks/useManualValues';
import { HEATING_RATE } from '@/lib/adjustments';
import { getMonthYearFromDate } from '@/lib/dates';
import { parseUnits } from '@/lib/dataManual';
import type { StoredInvoice } from '@/lib/storage';

/**
 * Manual heating value of the invoice's month (F30), same key ("Mon YYYY"), same maths (units × 76) and same saving as before.
 * Enter saves, Esc cancels. Built from the shared controls; Phase 9 moves it into the real drawer.
 */
function ManualValue({ month, currency }: { month: string; currency: string }) {
  const { values, setValue } = useManualValues();
  const value = values[month] || 0;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();

  const save = () => {
    const parsed = parseUnits(text);
    if (!parsed.ok) return setError(parsed.error);
    void setValue(month, parsed.value).catch((e) => console.error('Failed to save manual values:', e));
    setEditing(false);
    setError(undefined);
  };
  const cancel = () => {
    setEditing(false);
    setError(undefined);
  };

  return (
    <section className="lg-box" aria-label="Manual heating value">
      <div className="lg-box-head">
        <p className="lg-box-title">Manual Value (× {HEATING_RATE})</p>
        <p className="lg-box-sub">
          Current: {value} × {HEATING_RATE} = {(value * HEATING_RATE).toFixed(2)} {currency}
        </p>
      </div>
      {editing ? (
        <div className="lg-box-row">
          <Input
            numeric
            label={`Manual heating units for ${month}`}
            wrapperClassName="lg-box-field"
            value={text}
            error={error}
            placeholder="Enter value"
            autoFocus
            onChange={(e) => {
              setText(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation(); // do not also close the dialog
                cancel();
              }
            }}
          />
          <Button variant="secondary" onClick={save}>Save</Button>
          <Button variant="ghost" onClick={cancel}>Cancel</Button>
        </div>
      ) : (
        <div className="lg-box-row">
          <Button
            variant="secondary"
            onClick={() => {
              setText(value ? String(value) : '');
              setEditing(true);
            }}
          >
            {value ? 'Edit Manual Value' : 'Add Manual Value'}
          </Button>
        </div>
      )}
    </section>
  );
}

/**
 * TEMPORARY (Phase 8). The invoice detail as it was (`InvoiceCard`, the old manual-value box), now in a dialog with Prev / Next through the
 * current list, which replaces the ↑/↓ hotkeys. Phase 9 replaces this with the real drawer and the `?invoice=` link.
 */
export function LegacyDetailDialog({
  invoice, position, count, onPrev, onNext, onClose, returnFocusTo,
}: {
  invoice: StoredInvoice;
  position: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const { values } = useManualValues();
  const month = getMonthYearFromDate(invoice.invoice.issueDate);
  return (
    <Dialog
      wide
      closeButton
      title="Invoice details"
      returnFocusTo={returnFocusTo}
      onClose={onClose}
      actions={
        <>
          <span className="lg-pos">{position} of {count}</span>
          <Button variant="secondary" size="sm" icon={ChevronLeft} disabledReason={position <= 1 ? 'This is the first invoice in the list' : undefined} onClick={onPrev}>Prev</Button>
          <Button variant="secondary" size="sm" iconEnd={ChevronRight} disabledReason={position >= count ? 'This is the last invoice in the list' : undefined} onClick={onNext}>Next</Button>
          <Button variant="primary" data-autofocus onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="lg-detail">
        {invoice.invoice.invoiceType === 'Utility' && <ManualValue key={month} month={month} currency={invoice.invoice.currency} />}
        <InvoiceCard filename={invoice.filename} invoice={invoice.invoice} manualValue={values[month] || 0} />
      </div>
    </Dialog>
  );
}
