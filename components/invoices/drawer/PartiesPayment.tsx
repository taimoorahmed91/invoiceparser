'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { detailGroups, hasPolish, type DetailField } from '@/lib/invoiceDetail';
import type { ParsedInvoice } from '@/lib/parseInvoice';
import { CopyButton } from './CopyButton';

function Fields({ fields }: { fields: DetailField[] }) {
  return (
    <dl className="id-fields">
      {fields.map((f) => (
        <div key={f.label} className="id-field">
          <dt>{f.label}</dt>
          <dd>
            <span className={f.mono ? 'id-mono' : undefined} lang={hasPolish(f.value) ? 'pl' : undefined}>{f.value}</span>
            {f.copy && <CopyButton text={f.value} what={f.label.toLowerCase()} />}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Dates & payment" and "Parties" (plan §4.4, F28b): fields that were always stored but never shown. Read-only.
 * A field with no value is left out; a section with nothing to show is left out too.
 */
export function PartiesPayment({ invoice }: { invoice: ParsedInvoice }) {
  const g = detailGroups(invoice);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const dp = [...g.dates, ...g.payment];
  const hasParties = g.seller.length > 0 || g.purchaser.length > 0;
  if (dp.length === 0 && !hasParties) return null;
  return (
    <>
      {dp.length > 0 && (
        <section className="id-section" aria-labelledby={`${panelId}-dp`}>
          <h3 className="id-h" id={`${panelId}-dp`}>Dates &amp; payment</h3>
          <Fields fields={dp} />
        </section>
      )}
      {hasParties && (
        <section className="id-section">
          <h3 className="id-h id-h-btn">
            <Button variant="ghost" size="sm" iconEnd={ChevronDown} aria-expanded={open} aria-controls={panelId} className="id-disclose" data-open={open || undefined} onClick={() => setOpen((v) => !v)}>
              Parties
            </Button>
            <span className="id-hint">seller, NIP, purchaser</span>
          </h3>
          <div id={panelId} hidden={!open} className="id-parties">
            {g.seller.length > 0 && (
              <div>
                <h4 className="id-h2">Seller</h4>
                <Fields fields={g.seller} />
              </div>
            )}
            {g.purchaser.length > 0 && (
              <div>
                <h4 className="id-h2">Purchaser</h4>
                <Fields fields={g.purchaser} />
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
