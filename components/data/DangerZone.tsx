'use client';

import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/overlay/Dialog';
import { useToast } from '@/components/toast/ToastProvider';
import { useInvoices } from '@/hooks/useInvoices';

/**
 * Danger zone (plan §4.8 item 7): delete every invoice, after a confirm. Manual heating values are kept, and the success toast has Undo.
 * Delete and undo go through the same provider commands (and so the same storage calls) as the old Clear button.
 */
export function DangerZone() {
  const { invoices, removeAll, undo } = useInvoices();
  const toast = useToast();
  const opener = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = invoices.length;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeAll();
      setOpen(false);
      toast.warning(`Deleted all ${count} invoices`, {
        action: {
          label: 'Undo',
          onClick: () => {
            undo().then(
              (restored) => (restored ? toast.success('Invoices restored') : toast.info('Nothing to undo')),
              () => toast.error('Couldn’t restore the invoices. Reload from the database to see what is saved.'),
            );
          },
        },
      });
    } catch (err) {
      const message = `Couldn’t delete the invoices. Nothing was changed. ${err instanceof Error ? err.message : ''}`.trim();
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dt-card" data-tone="danger">
      <div>
        <h2 className="dt-title" id="danger-title">Danger zone</h2>
        <p className="dt-desc">Delete all invoices removes every invoice and its line items from the database. Your manual heating values are kept.</p>
      </div>
      <div className="dt-actions">
        <Button ref={opener} variant="destructive-quiet" icon={Trash2} disabledReason={count === 0 ? 'There are no invoices to delete' : undefined} onClick={() => setOpen(true)}>
          Delete all invoices…
        </Button>
      </div>
      {open && (
        <Dialog
          title={`Delete all ${count} ${count === 1 ? 'invoice' : 'invoices'}?`}
          description="Manual heating values are kept. You can undo right after."
          returnFocusTo={opener.current}
          onClose={close}
          actions={
            <>
              <Button variant="secondary" data-autofocus disabledReason={busy ? 'Deleting…' : undefined} onClick={close}>
                Cancel
              </Button>
              <Button variant="destructive" loading={busy} onClick={() => void confirm()}>
                {`Delete ${count} ${count === 1 ? 'invoice' : 'invoices'}`}
              </Button>
            </>
          }
        >
          {error && <p role="alert" className="field-error">{error}</p>}
        </Dialog>
      )}
    </div>
  );
}
