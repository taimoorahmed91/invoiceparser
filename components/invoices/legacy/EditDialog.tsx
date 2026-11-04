'use client';

import { useState } from 'react';
import { Dialog } from '@/components/overlay/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { INVOICE_TYPES } from '@/lib/invoiceList';
import { linkGross, linkNet, linkTax, textsFor, validateEdit, type EditTexts } from '@/lib/invoiceEdit';
import type { InvoiceType } from '@/lib/parseInvoice';
import type { StoredInvoice } from '@/lib/storage';

/**
 * TEMPORARY (Phase 8). The old inline edit form (type, net, tax, gross; same linkage, same 0.01 tolerance), in a dialog, built from the
 * shared controls. The mismatch is now said next to the field instead of in a toast. Phase 9 moves editing into the drawer.
 */
export function LegacyEditDialog({
  invoice, onSave, onClose, returnFocusTo,
}: {
  invoice: StoredInvoice;
  onSave: (next: StoredInvoice) => Promise<void>;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const currency = invoice.invoice.currency || 'PLN';
  const [type, setType] = useState<InvoiceType>(invoice.invoice.invoiceType);
  const [t, setT] = useState<EditTexts>(() => textsFor(invoice.invoice.totals));
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const check = validateEdit(t, currency);

  const save = async () => {
    if (!check.ok) return;
    setSaving(true);
    setFailure(null);
    try {
      await onSave({ ...invoice, invoice: { ...invoice.invoice, invoiceType: type, totals: { netTotal: check.net, taxTotal: check.tax, grossTotal: check.gross } } });
    } catch {
      setFailure('Couldn’t save the changes. Nothing was changed; your numbers are still here.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={`Edit invoice ${invoice.invoice.invoiceNumber}`}
      closeButton
      returnFocusTo={returnFocusTo}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="lg-edit-form" variant="primary" loading={saving} disabledReason={check.ok ? undefined : check.error}>Save changes</Button>
        </>
      }
    >
      <form id="lg-edit-form" className="lg-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as InvoiceType)} data-autofocus>
          {INVOICE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
        <Input numeric label={`Net total (${currency})`} value={t.net} onChange={(e) => setT(linkNet(t, e.target.value))} />
        <Input numeric label={`Tax (${currency})`} value={t.tax} onChange={(e) => setT(linkTax(t, e.target.value))} />
        <Input
          numeric
          label={`Gross total (${currency})`}
          value={t.gross}
          helper="Calculated from Net + Tax"
          error={check.ok ? undefined : check.error}
          onChange={(e) => setT(linkGross(t, e.target.value))}
        />
        {failure && <p role="alert" className="field-error">{failure}</p>}
      </form>
    </Dialog>
  );
}
