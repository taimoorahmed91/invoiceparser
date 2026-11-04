'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/toast/ToastProvider';
import { useManualValues } from '@/hooks/useManualValues';
import { HEATING_RATE } from '@/lib/adjustments';
import { formatUnits, parseUnits } from '@/lib/dataManual';
import { fmtMoney, fmtNumber } from '@/lib/format';

/**
 * Manual heating value of the invoice's month (plan §4.4, F30), Utility invoices only. Same key ("Mon YYYY"), same maths (units × 76),
 * same saving (`saveManualValues`) as the old editor. Enter saves, Esc cancels (and does not also close the drawer).
 * Shows a live "N × 76 = X" while typing, says what the value does, and confirms "Saved" in the page (the toast sits behind the open drawer).
 */
export function ManualHeatingEditor({ month, currency }: { month: string; currency: string }) {
  const { values, setValue } = useManualValues();
  const toast = useToast();
  const units = values[month] > 0 ? values[month] : 0;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const editBtn = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const parsed = parseUnits(text);
  const previewUnits = parsed.ok ? parsed.value : null;
  const adjustment = (u: number) => u * HEATING_RATE;

  const start = () => {
    setText(formatUnits(units));
    setError(undefined);
    setSaved(false);
    setFailed(false);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(undefined);
    requestAnimationFrame(() => editBtn.current?.focus());
  };
  const save = async () => {
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setEditing(false);
    setFailed(false);
    try {
      await setValue(month, parsed.value);
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 4000);
      toast.success(`Saved heating units for ${month}`);
    } catch (e) {
      console.error('Failed to save manual values:', e);
      setFailed(true);
      toast.error('Couldn’t save the heating units. The value is shown, but it may be gone after a reload.');
    }
    requestAnimationFrame(() => editBtn.current?.focus());
  };

  return (
    <section className="id-section" aria-labelledby="id-manual-h">
      <h3 className="id-h" id="id-manual-h">Manual heating</h3>
      <p className="id-note">
        Moves the heating units you read off the meter from Central Heating into a separate heating line (units × {HEATING_RATE}). The invoice total does not change.
      </p>
      {editing ? (
        <div className="id-manual-edit">
          <Input
            numeric
            label={`Manual heating units for ${month}`}
            wrapperClassName="id-manual-field"
            value={text}
            error={error}
            placeholder="Enter units"
            autoFocus
            helper={previewUnits !== null && previewUnits > 0 ? `${fmtNumber(previewUnits, 4)} × ${HEATING_RATE} = ${fmtMoney(adjustment(previewUnits), currency)}` : 'Leave empty to remove the value'}
            onChange={(e) => {
              setText(e.target.value);
              setError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void save();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation(); // do not also close the drawer
                cancel();
              }
            }}
          />
          <div className="id-manual-actions">
            <Button variant="secondary" size="sm" onClick={() => void save()}>Save</Button>
            <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="id-manual-row">
          <p className="id-manual-now">
            {units > 0 ? (
              <>Units for {month}: <strong>{fmtNumber(units, 4)}</strong> × {HEATING_RATE} = <strong>{fmtMoney(adjustment(units), currency)}</strong></>
            ) : (
              <>No units set for {month}.</>
            )}
          </p>
          <Button ref={editBtn} variant="secondary" size="sm" onClick={start}>{units > 0 ? 'Edit units' : 'Add units'}</Button>
        </div>
      )}
      <p className="id-saved" role="status">
        {saved && !editing && (<><Check size={14} strokeWidth={2} aria-hidden="true" /> Saved</>)}
        {failed && !editing && 'Not saved — try again.'}
      </p>
    </section>
  );
}
