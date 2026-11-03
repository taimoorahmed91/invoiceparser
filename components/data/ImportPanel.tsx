'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import { FileUp, Upload } from 'lucide-react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/toast/ToastProvider';
import { useInvoices } from '@/hooks/useInvoices';
import { describePlan, planImport, type ImportPlan } from '@/lib/importPlan';
import { generateId } from '@/lib/storage';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Import JSON with a preview (plan §4.8 item 2): pick a file, see "26 invoices found · 3 already exist · 23 new", then choose.
 * Nothing is written until a button is pressed, and an invoice that already exists is never added a second time (P21).
 */
export function ImportPanel() {
  const { invoices, importRows } = useInvoices();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPlan(null);
    setFileName('');
    setError(null);
  };

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // the same file can be picked again
    if (!file) return;
    setPlan(null);
    setError(null);
    setFileName(file.name);
    try {
      const result = planImport(await file.text(), invoices, generateId);
      if (result.ok) setPlan(result);
      else setError(result.error);
    } catch (err) {
      setError(`This file could not be read (${err instanceof Error ? err.message : 'unknown error'}).`);
    }
  };

  const run = async (withExisting: boolean) => {
    if (!plan) return;
    const rows = withExisting ? [...plan.fresh, ...plan.replaceable] : plan.fresh;
    setBusy(true);
    setError(null);
    try {
      await importRows(rows);
      const parts = [`Imported ${plural(plan.fresh.length, 'new invoice')}`];
      if (withExisting && plan.replaceable.length) parts.push(`replaced ${plan.replaceable.length}`);
      toast.success(parts.join(', '));
      reset();
    } catch (err) {
      const message = `Couldn’t save the import. Nothing was added to your list. ${err instanceof Error ? err.message : ''}`.trim();
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const fresh = plan?.fresh.length ?? 0;
  const existing = plan?.replaceable.length ?? 0;
  const shownNumbers = plan ? plan.existingNumbers.slice(0, 5) : [];

  return (
    <div className="dt-group">
      <div>
        <h3 className="dt-sub">Import</h3>
        <p className="dt-desc">Add invoices from a JSON file made by Export. You see what is new before anything is saved.</p>
      </div>
      <div className="dt-actions">
        <input ref={input} type="file" accept=".json,application/json" data-import className="sr-only-text" tabIndex={-1} aria-hidden="true" onChange={onPick} />
        <Button variant="secondary" icon={Upload} onClick={() => input.current?.click()} disabledReason={busy ? 'Importing…' : undefined}>
          Choose a JSON file
        </Button>
      </div>

      {error && <Banner>{error}</Banner>}

      {plan && (
        <section className="dt-preview" aria-label="Import preview">
          <p className="dt-preview-file">{fileName}</p>
          <p className="dt-preview-line" role="status">{describePlan(plan)}</p>
          {plan.found === 0 && <p className="dt-preview-extra">This file has no invoices in it.</p>}
          {existing > 0 && (
            <p className="dt-preview-extra">
              Already in your list: {shownNumbers.join(', ')}
              {existing > shownNumbers.length ? ` and ${existing - shownNumbers.length} more` : ''}. They are skipped unless you choose to replace them.
            </p>
          )}
          {plan.repeated > 0 && <p className="dt-preview-extra">{plural(plan.repeated, 'invoice')} {plan.repeated === 1 ? 'appears' : 'appear'} twice in the file; only the first is used.</p>}
          {plan.unreadable > 0 && (
            <p className="dt-preview-extra">
              {plural(plan.unreadable, 'entry', 'entries')} in the file {plan.unreadable === 1 ? 'does' : 'do'} not look like an invoice and {plan.unreadable === 1 ? 'is' : 'are'} skipped.
            </p>
          )}
          <div className="dt-actions">
            <Button variant="primary" icon={FileUp} loading={busy} disabledReason={fresh === 0 ? 'Nothing new to import' : undefined} onClick={() => void run(false)}>
              {`Import ${fresh}`}
            </Button>
            {existing > 0 && (
              <Button variant="secondary" disabledReason={busy ? 'Importing…' : undefined} onClick={() => void run(true)}>
                {fresh > 0 ? `Replace the ${existing} existing too` : `Replace the ${existing} existing`}
              </Button>
            )}
            <Button variant="ghost" disabledReason={busy ? 'Importing…' : undefined} onClick={reset}>
              Cancel
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
