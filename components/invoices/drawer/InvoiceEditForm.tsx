'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { INVOICE_TYPES } from '@/lib/invoiceList';
import { linkGross, linkNet, linkTax, textsFor, validateEdit, type EditCheck, type EditTexts } from '@/lib/invoiceEdit';
import type { InvoiceType } from '@/lib/parseInvoice';
import type { StoredInvoice } from '@/lib/storage';

export interface EditDraft {
  type: InvoiceType;
  texts: EditTexts;
  setType: (t: InvoiceType) => void;
  setTexts: (t: EditTexts) => void;
  check: EditCheck;
  /** Something differs from what is stored (drives "discard changes?"). */
  dirty: boolean;
}

/** The edit form's state (F13): the type and the three amounts as typed text, with the old linkage and the 0.01 check (lib/invoiceEdit). */
export function useEditDraft(stored: StoredInvoice): EditDraft {
  const initial = useMemo(() => textsFor(stored.invoice.totals), [stored]);
  const [type, setType] = useState<InvoiceType>(stored.invoice.invoiceType);
  const [texts, setTexts] = useState<EditTexts>(initial);
  // Prev / Next show another invoice in the same drawer: start its draft from that invoice (state adjusted while rendering, no flash of the old one)
  const [forId, setForId] = useState(stored.id);
  if (forId !== stored.id) {
    setForId(stored.id);
    setType(stored.invoice.invoiceType);
    setTexts(initial);
  }
  const check = validateEdit(texts, stored.invoice.currency || 'PLN');
  const dirty = type !== stored.invoice.invoiceType || texts.net !== initial.net || texts.tax !== initial.tax || texts.gross !== initial.gross;
  return { type, texts, setType, setTexts, check, dirty };
}

/**
 * Edit mode (plan §4.4, F13): the three stat tiles become inputs. Net / VAT edit → Total = Net + VAT; Total edit → VAT = max(0, Total − Net);
 * the mismatch is said under Total, inline. Saving happens from the drawer's sticky footer (this form's `id`).
 */
export function InvoiceEditForm({ draft, currency, formId, onSubmit, failure }: { draft: EditDraft; currency: string; formId: string; onSubmit: () => void; failure: string | null }) {
  const { texts, type, setTexts, setType, check } = draft;
  return (
    <form id={formId} className="id-edit" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <Select label="Type" value={type} onChange={(e) => setType(e.target.value as InvoiceType)}>
        {INVOICE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
      </Select>
      <div className="id-edit-amounts">
        <Input numeric label="Net" suffix={currency} value={texts.net} onChange={(e) => setTexts(linkNet(texts, e.target.value))} />
        <Input numeric label="VAT" suffix={currency} value={texts.tax} onChange={(e) => setTexts(linkTax(texts, e.target.value))} />
        <Input
          numeric
          label="Total"
          suffix={currency}
          value={texts.gross}
          helper="Net + VAT. Type a total to change the VAT."
          error={check.ok ? undefined : check.error}
          onChange={(e) => setTexts(linkGross(texts, e.target.value))}
        />
      </div>
      {failure && <p role="alert" className="field-error">{failure}</p>}
    </form>
  );
}
