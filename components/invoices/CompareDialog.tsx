'use client';

import { Fragment, useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronDown, Info } from 'lucide-react';
import { DataPanel } from '@/components/charts/DataPanel';
import { DataTable } from '@/components/charts/DataTable';
import { Dialog } from '@/components/overlay/Dialog';
import { Button } from '@/components/ui/Button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  compareInvoices, grossDelta, linesSpec, quantityDelta, statusLabel, totalDelta, totalsSpec, unitPriceDelta, type Comparison, type LineMatch,
} from '@/lib/compare';
import { fmtDate, fmtMoney, fmtQuantity, type Delta } from '@/lib/format';
import { hasPolish } from '@/lib/invoiceDetail';
import type { StoredInvoice } from '@/lib/storage';
import { TypeBadge } from './TypeBadge';

/** ▲ +123,40 zł · +4,2 % : sign and arrow are in the text; colour (cost up = red, down = green) only supports it. */
function DeltaText({ delta }: { delta: Delta | null }) {
  if (!delta) return <span className="cmp-delta" data-dir="flat">—</span>;
  return <span className="cmp-delta" data-dir={delta.direction}>{delta.text}</span>;
}

function Card({ tag, stored }: { tag: 'A' | 'B'; stored: StoredInvoice }) {
  const inv = stored.invoice;
  return (
    <section className="cmp-card" aria-label={`Invoice ${tag}`}>
      <span className="cmp-tag" aria-hidden="true">{tag}</span>
      <div className="cmp-card-main">
        <p className="cmp-num">{inv.invoiceNumber}</p>
        <p className="cmp-sub">{inv.issueDate ? `Issued ${fmtDate(inv.issueDate)}` : 'No issue date'}</p>
        <TypeBadge invoice={stored} />
        <p className="cmp-file">{stored.filename}</p>
      </div>
    </section>
  );
}

function Totals({ c, phone }: { c: Comparison; phone: boolean }) {
  const spec = useMemo(() => totalsSpec(c), [c]);
  if (phone) {
    return (
      <ul className="cmp-stack" aria-label="Totals">
        {c.totals.map((t) => (
          <li key={t.key} className="cmp-stack-row">
            <p className="cmp-stack-h">{t.label}</p>
            <dl className="cmp-ab">
              <div><dt>A</dt><dd>{fmtMoney(t.a, c.currencyA)}</dd></div>
              <div><dt>B</dt><dd>{fmtMoney(t.b, c.currencyB)}</dd></div>
              <div><dt>Difference</dt><dd><DeltaText delta={c.sameCurrency ? totalDelta(t, c.currencyA) : null} /></dd></div>
            </dl>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <DataTable
      table={spec}
      caption="Totals of A and B"
      renderCell={(col, _row, i) => (col.key === 'delta' ? <DeltaText delta={c.sameCurrency ? totalDelta(c.totals[i], c.currencyA) : null} /> : undefined)}
    />
  );
}

/** The expander under a line: quantity and unit price of A and B and what changed (parity with the old per-line quantity / unit-price lines). */
function Details({ m, c, id }: { m: LineMatch; c: Comparison; id: string }) {
  const qty = (i: LineMatch['a']) => (i ? fmtQuantity(i.quantity, i.unit) : '—');
  const price = (i: LineMatch['a'], cur: string) => (i ? fmtMoney(i.netPrice, cur) : '—');
  return (
    <dl id={id} className="cmp-details">
      <div><dt>Quantity</dt><dd><span>A {qty(m.a)}</span><span>B {qty(m.b)}</span>{c.sameCurrency && m.status === 'both' && <DeltaText delta={quantityDelta(m)} />}</dd></div>
      <div><dt>Unit price</dt><dd><span>A {price(m.a, c.currencyA)}</span><span>B {price(m.b, c.currencyB)}</span>{c.sameCurrency && m.status === 'both' && <DeltaText delta={unitPriceDelta(m, c.currencyA)} />}</dd></div>
    </dl>
  );
}

function Description({ m }: { m: LineMatch }) {
  return (
    <>
      <span lang={hasPolish(m.description) ? 'pl' : undefined}>{m.description}</span>
      {m.status !== 'both' && <span className="cmp-chip">{statusLabel(m.status)}</span>}
    </>
  );
}

function Lines({ c, phone }: { c: Comparison; phone: boolean }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const gross = (i: LineMatch['a'], cur: string) => (i ? fmtMoney(i.grossValue, cur) : '—');
  const toggler = (m: LineMatch, i: number) => (
    <Button variant="ghost" size="sm" iconEnd={ChevronDown} aria-expanded={open.has(m.key)} aria-controls={`cmp-d-${i}`} className="id-disclose" data-open={open.has(m.key) || undefined} onClick={() => toggle(m.key)}>
      Details<span className="sr-only-text"> for {m.description}</span>
    </Button>
  );

  if (phone) {
    return (
      <ul className="cmp-stack" aria-label="Line items">
        {c.lines.map((m, i) => (
          <li key={m.key} className="cmp-stack-row" data-status={m.status}>
            <p className="cmp-stack-h"><Description m={m} /></p>
            <dl className="cmp-ab">
              <div><dt>A</dt><dd>{m.a ? gross(m.a, c.currencyA) : <span className="cmp-none">Not in A</span>}</dd></div>
              <div><dt>B</dt><dd>{m.b ? gross(m.b, c.currencyB) : <span className="cmp-none">Not in B</span>}</dd></div>
              {m.status === 'both' && <div><dt>Difference</dt><dd><DeltaText delta={c.sameCurrency ? grossDelta(m, c.currencyA) : null} /></dd></div>}
            </dl>
            {toggler(m, i)}
            {open.has(m.key) && <Details m={m} c={c} id={`cmp-d-${i}`} />}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="dv-table-wrap" tabIndex={0} role="region" aria-label="Line items, table">
      <table className="dv-table cmp-table">
        <caption className="sr-only-text">Line items of A and B, matched by description</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left">Description</th>
            <th scope="col" className="text-right">A gross</th>
            <th scope="col" className="text-right">B gross</th>
            <th scope="col" className="text-right">Difference</th>
            <th scope="col" className="text-right"><span className="sr-only-text">Details</span></th>
          </tr>
        </thead>
        <tbody>
          {c.lines.map((m, i) => (
            <Fragment key={m.key}>
              <tr data-status={m.status}>
                <th scope="row" className="text-left cmp-desc"><Description m={m} /></th>
                <td className="text-right">{m.a ? gross(m.a, c.currencyA) : <span className="cmp-none">—</span>}</td>
                <td className="text-right">{m.b ? gross(m.b, c.currencyB) : <span className="cmp-none">—</span>}</td>
                <td className="text-right">{m.status === 'both' ? <DeltaText delta={c.sameCurrency ? grossDelta(m, c.currencyA) : null} /> : ''}</td>
                <td className="text-right">{toggler(m, i)}</td>
              </tr>
              {open.has(m.key) && (
                <tr className="cmp-details-row">
                  <td colSpan={5}><Details m={m} c={c} id={`cmp-d-${i}`} /></td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Compare two invoices (plan §4.5, F17). A and B side by side with Swap, the totals and the line items as DataPanels (Expand, CSV / PDF),
 * lines matched by description with "Only in A / B" chips and a Details expander per line. Differences are B − A.
 * Phones: full screen, A and B stacked in every row. Close returns focus to the Compare button.
 */
export function CompareDialog({ a: first, b: second, onClose, returnFocusTo }: { a: StoredInvoice; b: StoredInvoice; onClose: () => void; returnFocusTo: HTMLElement | null }) {
  const [pair, setPair] = useState<[StoredInvoice, StoredInvoice]>([first, second]);
  const [a, b] = pair;
  const phone = useMediaQuery('(max-width: 639px)');
  const c = useMemo(() => compareInvoices(a.invoice, b.invoice), [a, b]);
  const lines = useMemo(() => linesSpec(c), [c]);
  const totals = useMemo(() => totalsSpec(c), [c]);
  const range = `A ${a.invoice.invoiceNumber} · B ${b.invoice.invoiceNumber}`;
  const counts = `${c.counts.both} in both · ${c.counts.onlyA} only in A · ${c.counts.onlyB} only in B`;

  return (
    <Dialog
      wide
      closeButton
      className="dlg-compare"
      title="Compare invoices"
      description="Differences show B compared with A (B − A)."
      returnFocusTo={returnFocusTo}
      onClose={onClose}
      actions={<Button variant="secondary" data-autofocus onClick={onClose}>Close</Button>}
    >
      <div className="cmp-heads">
        <Card tag="A" stored={a} />
        <Button variant="secondary" size="sm" icon={ArrowLeftRight} className="cmp-swap" onClick={() => setPair([b, a])}>Swap A and B</Button>
        <Card tag="B" stored={b} />
      </div>

      {!c.sameCurrency && (
        <p className="cmp-note" role="note"><Info size={16} strokeWidth={1.75} aria-hidden="true" /> These invoices use different currencies (A: {c.currencyA}, B: {c.currencyB}), so no differences are shown.</p>
      )}

      <DataPanel
        title="Totals"
        headingLevel={3}
        storageKey="compare.totals"
        table={totals}
        chartDisabledReason="Two invoices’ totals are not a time series, so there is no chart for them."
        chartHeight={0}
        range={range}
        filters="Difference = B − A"
        renderTable={() => <Totals c={c} phone={phone} />}
      />

      <DataPanel
        title="Line items"
        headingLevel={3}
        subtitle={counts}
        storageKey="compare.lines"
        table={lines}
        chartDisabledReason="Line items are not a time series, so there is no chart for them."
        chartHeight={0}
        range={range}
        filters="Matched by description · Difference = B − A"
        renderTable={() => <Lines c={c} phone={phone} />}
      />

      {c.collapsed > 0 && (
        <p className="cmp-note" role="note">
          <Info size={16} strokeWidth={1.75} aria-hidden="true" /> {c.collapsed} {c.collapsed === 1 ? 'line shares' : 'lines share'} a description with another line of the same invoice. As before, only the last line of each description is compared.
        </p>
      )}
    </Dialog>
  );
}
