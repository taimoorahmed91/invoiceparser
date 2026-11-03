'use client';

import { useState } from 'react';
import { CircleAlert, CircleCheck, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/toast/ToastProvider';
import { useInvoices } from '@/hooks/useInvoices';
import { useManualValues } from '@/hooks/useManualValues';
import { fmtClock } from '@/lib/format';

/**
 * Sync (plan §4.8 item 3). Every change is saved as you make it; this card says so, shows when the list was last read,
 * and has the two manual actions: read everything again, and write the manual heating values now (the old "Save Session").
 */
export function SyncPanel() {
  const invoices = useInvoices();
  const manual = useManualValues();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const reloading = invoices.status === 'loading' || manual.status === 'loading';

  const state: 'busy' | 'error' | 'ok' = invoices.syncStatus === 'saving' || manual.syncStatus === 'saving' ? 'busy' : invoices.syncStatus === 'error' || manual.syncStatus === 'error' ? 'error' : 'ok';
  const Icon = state === 'ok' ? CircleCheck : state === 'error' ? CircleAlert : RefreshCw;
  const loaded = invoices.loadedAt ? ` · last loaded ${fmtClock(invoices.loadedAt)}` : '';
  const text =
    state === 'busy' ? 'Saving your changes…'
    : state === 'error' ? `Some changes could not be saved: ${invoices.error ?? manual.error ?? 'unknown error'}`
    : `All changes are saved to the database automatically${loaded}`;

  const reload = async () => {
    await Promise.all([invoices.reload(), manual.reload()]);
    toast.success('Reloaded from the database');
  };
  const saveNow = async () => {
    setSaving(true);
    try {
      await manual.saveAll();
      toast.success('Manual heating values saved to the database');
    } catch (err) {
      toast.error(`Couldn’t save the manual heating values: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dt-card">
      <div>
        <h2 className="dt-title" id="sync-title">Sync</h2>
        <p className="dt-desc">Your invoices and manual heating values live in the database, so every device sees the same data.</p>
      </div>
      <p className="dt-status" data-state={state} role="status">
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        <span>{text}</span>
      </p>
      <div className="dt-actions">
        <Button variant="secondary" icon={RefreshCw} loading={reloading} onClick={() => void reload()}>
          Reload from database
        </Button>
        <Button variant="secondary" icon={Save} loading={saving} onClick={() => void saveNow()}>
          Save manual values now
        </Button>
      </div>
    </div>
  );
}
