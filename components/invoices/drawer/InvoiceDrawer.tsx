'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/overlay/Dialog';
import { Drawer } from '@/components/overlay/Drawer';
import { Button } from '@/components/ui/Button';
import { useManualValues } from '@/hooks/useManualValues';
import { computeLineItemView } from '@/lib/adjustments';
import { getMonthYearFromDate } from '@/lib/dates';
import { fmtMoney, fmtNumber } from '@/lib/format';
import { HEATING_RATE } from '@/lib/adjustments';
import type { Neighbours } from '@/lib/invoiceDetail';
import type { StoredInvoice } from '@/lib/storage';
import { InvoiceEditForm, useEditDraft } from './InvoiceEditForm';
import { InvoiceHeader } from './InvoiceHeader';
import { LineItems } from './LineItems';
import { ManualHeatingEditor } from './ManualHeatingEditor';
import { PartiesPayment } from './PartiesPayment';

function Tile({ label, value, hero }: { label: string; value: string; hero?: boolean }) {
  return (
    <div className="id-tile" data-hero={hero || undefined}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Net / VAT / (manual lines) / Gross, as the old totals block showed them. The two heating lines appear whenever a manual value is set. */
function Totals({ stored, manualValue }: { stored: StoredInvoice; manualValue: number }) {
  const inv = stored.invoice;
  const cur = inv.currency || 'PLN';
  const adj = manualValue * HEATING_RATE;
  return (
    <section className="id-section" aria-labelledby="id-totals-h">
      <h3 className="id-h" id="id-totals-h">Totals</h3>
      <dl className="id-totals">
        <div><dt>Net</dt><dd>{fmtMoney(inv.totals.netTotal, cur)}</dd></div>
        <div><dt>VAT</dt><dd>{fmtMoney(inv.totals.taxTotal, cur)}</dd></div>
        {manualValue > 0 && (
          <>
            <div><dt>Manual heating added ({fmtNumber(manualValue, 4)} × {HEATING_RATE})</dt><dd>{fmtMoney(adj, cur)}</dd></div>
            <div><dt>Central heating adjusted</dt><dd>{fmtMoney(-adj, cur)}</dd></div>
          </>
        )}
        <div className="id-totals-gross"><dt>Gross</dt><dd>{fmtMoney(inv.totals.grossTotal, cur)}</dd></div>
      </dl>
    </section>
  );
}

/**
 * The invoice drawer (plan §4.4, F13 F14 F28 F28b F29 F30). A right-hand panel, a bottom sheet on phones. Shows the invoice, steps through
 * the list (Prev / Next), edits type / net / VAT / total, deletes (the page shows the Undo toast), and keeps the manual heating value.
 * Leaving edit mode with changes asks first. Esc, the scrim and Close all go through the same check.
 */
export function InvoiceDrawer({
  stored, nav, startInEdit, onPrev, onNext, onClose, onSave, onDelete, getReturnFocus,
}: {
  stored: StoredInvoice;
  nav: Neighbours;
  startInEdit: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onSave: (next: StoredInvoice) => Promise<void>;
  onDelete: () => void;
  getReturnFocus: () => HTMLElement | null;
}) {
  const titleId = useId();
  const formId = useId();
  const inv = stored.invoice;
  const cur = inv.currency || 'PLN';
  const { values } = useManualValues();
  const isUtility = inv.invoiceType === 'Utility';
  const month = getMonthYearFromDate(inv.issueDate);
  // The manual value belongs to Utility invoices only (the editor, the exports and now the line items agree).
  const manualValue = isUtility ? values[month] || 0 : 0;
  const view = computeLineItemView(inv.lineItems, manualValue);

  const [editing, setEditing] = useState(startInEdit);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [confirm, setConfirm] = useState<{ action: () => void; opener: HTMLElement | null } | null>(null);
  const [forId, setForId] = useState(stored.id);
  const draft = useEditDraft(stored);
  const editBtn = useRef<HTMLButtonElement>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  if (forId !== stored.id) {
    setForId(stored.id);
    setEditing(false);
    setFailure(null);
    setSavedNote(false);
  }

  const dirty = editing && draft.dirty;
  // A reload or closing the tab with unsaved edits asks first, too.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Runs `action` now, or after "Discard changes?" when edits would be lost. */
  const leave = (action: () => void) => {
    if (dirty) setConfirm({ action, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null });
    else action();
  };

  const focusEdit = () => requestAnimationFrame(() => editBtn.current?.focus());
  const cancelEdit = () => {
    setEditing(false);
    setFailure(null);
    focusEdit();
  };

  const save = async () => {
    if (!draft.check.ok || saving) return;
    const { net, tax, gross } = draft.check;
    setSaving(true);
    setFailure(null);
    try {
      await onSave({ ...stored, invoice: { ...inv, invoiceType: draft.type, totals: { netTotal: net, taxTotal: tax, grossTotal: gross } } });
      setEditing(false);
      setSavedNote(true);
      clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setSavedNote(false), 4000);
      focusEdit();
    } catch {
      setFailure('Couldn’t save the changes. Nothing was changed; your numbers are still here.');
    } finally {
      setSaving(false);
    }
  };

  const footer = editing ? (
    <>
      <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
      <Button type="submit" form={formId} variant="primary" loading={saving} disabledReason={draft.check.ok ? undefined : draft.check.error}>Save changes</Button>
    </>
  ) : undefined;

  return (
    <>
      <Drawer
        labelledBy={titleId}
        getReturnFocus={getReturnFocus}
        onClose={() => leave(onClose)}
        header={<InvoiceHeader stored={stored} titleId={titleId} nav={nav} onPrev={() => leave(onPrev)} onNext={() => leave(onNext)} onClose={() => leave(onClose)} />}
        footer={footer}
      >
        {editing ? (
          <InvoiceEditForm draft={draft} currency={cur} formId={formId} failure={failure} onSubmit={() => void save()} />
        ) : (
          <>
            <dl className="id-tiles" aria-label="Amounts">
              <Tile label="Total" value={fmtMoney(inv.totals.grossTotal, cur)} hero />
              <Tile label="Net" value={fmtMoney(inv.totals.netTotal, cur)} />
              <Tile label="VAT" value={fmtMoney(inv.totals.taxTotal, cur)} />
            </dl>
            <div className="id-actions">
              <Button ref={editBtn} variant="secondary" icon={Pencil} onClick={() => { setSavedNote(false); setEditing(true); }}>Edit</Button>
              <Button variant="destructive-quiet" icon={Trash2} onClick={onDelete}>Delete</Button>
            </div>
            <p className="id-saved" role="status">{savedNote && (<><Check size={14} strokeWidth={2} aria-hidden="true" /> Changes saved</>)}</p>
          </>
        )}

        <div key={stored.id} className="id-stack">
          <PartiesPayment invoice={inv} />
          <LineItems stored={stored} view={view} />
          {isUtility && <ManualHeatingEditor month={month} currency={cur} />}
          {!editing && <Totals stored={stored} manualValue={manualValue} />}
        </div>
      </Drawer>

      {confirm && (
        <Dialog
          title="Discard your changes?"
          description={`The changes to ${inv.invoiceNumber} have not been saved.`}
          returnFocusTo={confirm.opener}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Button variant="ghost" data-autofocus onClick={() => setConfirm(null)}>Keep editing</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const run = confirm.action;
                  setConfirm(null);
                  setEditing(false);
                  run();
                }}
              >
                Discard changes
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
