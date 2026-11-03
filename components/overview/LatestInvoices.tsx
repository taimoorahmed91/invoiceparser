'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { latestInvoices } from '@/lib/analyticsOverview';
import { fmtDate, fmtMoney } from '@/lib/format';
import { ALL_INVOICES, invoiceLink, storeLegacyFilters } from '@/lib/overviewLinks';
import type { StoredInvoice } from '@/lib/storage';

/** The 5 most recent invoices; each row opens the Invoices page on that invoice (drawer deep link arrives in Phase 9). */
export function LatestInvoices({ invoices }: { invoices: StoredInvoice[] }) {
  const rows = latestInvoices(invoices, 5);
  return (
    <section className="ov-card" aria-labelledby="ov-latest-title">
      <div className="ov-card-head">
        <h2 className="ov-card-title" id="ov-latest-title">Latest invoices</h2>
        <Button variant="link" href={ALL_INVOICES.href} iconEnd={ArrowRight}>
          View all invoices
        </Button>
      </div>
      <ul className="ov-rows">
        {rows.map(({ stored, kinds, label }) => {
          const link = invoiceLink(stored);
          const inv = stored.invoice;
          return (
            <li key={stored.id}>
              <Link href={link.href} className="ov-row" onClick={() => storeLegacyFilters(link.filters)} aria-label={`${inv.invoiceNumber}, ${fmtDate(inv.issueDate)}, ${label}, ${fmtMoney(inv.totals.grossTotal, inv.currency || 'PLN')}`}>
                <span className="ov-row-num">{inv.invoiceNumber}</span>
                <span className="ov-row-meta">
                  <span className="ov-row-date">{fmtDate(inv.issueDate)}</span>
                  <span className="ov-row-kinds">
                    {kinds.map((k, i) => (
                      <span key={k} style={{ display: 'contents' }}>
                        {i > 0 && <span className="ov-chip-plus" aria-hidden="true">+</span>}
                        <span className="ov-chip" data-kind={k}>{k}</span>
                      </span>
                    ))}
                  </span>
                </span>
                <span className="ov-row-amount">{fmtMoney(inv.totals.grossTotal, inv.currency || 'PLN')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
