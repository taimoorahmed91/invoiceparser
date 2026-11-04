'use client';

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { SortButton } from '@/components/ui/SortButton';
import { fmtDate, fmtMoney } from '@/lib/format';
import { MAX_COMPARE, ariaSortOf, type ListSort, type SortField } from '@/lib/invoiceList';
import type { StoredInvoice } from '@/lib/storage';
import { RowMenu } from './RowMenu';
import { TypeBadge } from './TypeBadge';

export interface InvoiceListHandlers {
  sort: ListSort;
  onSort: (field: SortField) => void;
  selected: readonly string[];
  onToggle: (id: string) => void;
  /** `opener` is where focus returns to when the detail closes. */
  onOpen: (invoice: StoredInvoice, opener: HTMLElement | null) => void;
  onEdit: (invoice: StoredInvoice) => void;
  onDelete: (invoice: StoredInvoice) => void;
}

const INTERACTIVE = 'button, a, input, label, select, [role="menuitem"], [role="menu"]';

function SelectBox({ inv, h }: { inv: StoredInvoice; h: InvoiceListHandlers }) {
  const checked = h.selected.includes(inv.id);
  return (
    <Checkbox
      cell
      aria-label={`Select ${inv.invoice.invoiceNumber}`}
      checked={checked}
      disabledReason={!checked && h.selected.length >= MAX_COMPARE ? 'Compare works with two invoices' : undefined}
      onChange={() => h.onToggle(inv.id)}
    />
  );
}

/**
 * The invoices as a table (plan §4.3). Real <th aria-sort> with a button in each sortable header; one tab stop for the table, ↑/↓/Home/End move
 * between rows (roving tabindex), Enter opens the row, Space ticks it. Nothing listens outside the table. The number is a real button;
 * the rest of the row also opens it for the mouse.
 */
export function InvoiceTable({ rows, h, scroll }: { rows: StoredInvoice[]; h: InvoiceListHandlers; scroll?: boolean }) {
  const root = useRef<HTMLTableElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const current = rows.some((r) => r.id === activeId) ? activeId : rows[0]?.id ?? null;

  // Roving tabindex: only the active row (and, through it, its own controls) is reachable with Tab. The row menu manages its own items.
  useLayoutEffect(() => {
    root.current?.querySelectorAll<HTMLElement>('tbody tr[data-row-id]').forEach((tr) => {
      const active = tr.dataset.rowId === current;
      tr.tabIndex = active ? 0 : -1;
      tr.querySelectorAll<HTMLElement>('button:not(.menu-item), input, a').forEach((c) => {
        if (active) c.removeAttribute('tabindex');
        else c.setAttribute('tabindex', '-1');
      });
    });
  });

  const focusRow = useCallback((id: string | undefined) => {
    if (!id) return;
    const el = root.current?.querySelector<HTMLElement>(`tr[data-row-id="${CSS.escape(id)}"]`);
    if (!el) return;
    setActiveId(id);
    el.tabIndex = 0;
    el.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLTableSectionElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return; // a menu already used the key
    const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-row-id]');
    if (!tr) return;
    const i = rows.findIndex((r) => r.id === tr.dataset.rowId);
    if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(rows[Math.min(rows.length - 1, i + 1)]?.id); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(rows[Math.max(0, i - 1)]?.id); }
    else if (e.key === 'Home') { e.preventDefault(); focusRow(rows[0]?.id); }
    else if (e.key === 'End') { e.preventDefault(); focusRow(rows[rows.length - 1]?.id); }
    else if (e.target === tr && e.key === 'Enter') { e.preventDefault(); h.onOpen(rows[i], tr.querySelector<HTMLElement>('.inv-num')); }
    else if (e.target === tr && e.key === ' ') {
      e.preventDefault();
      const r = rows[i];
      if (h.selected.includes(r.id) || h.selected.length < MAX_COMPARE) h.onToggle(r.id);
    }
  };

  return (
    <div className="dv-table-wrap inv-wrap" style={scroll ? { maxHeight: '100%' } : undefined}>
      <table ref={root} className="dv-table inv-table">
        <caption className="sr-only-text">Invoices, {rows.length} shown. Use the up and down arrow keys to move between rows.</caption>
        <thead>
          <tr>
            <th scope="col" className="inv-col-select"><span className="sr-only-text">Select</span></th>
            <th scope="col" aria-sort={ariaSortOf(h.sort, 'number')}><SortButton label="Invoice" direction={ariaSortOf(h.sort, 'number')} onClick={() => h.onSort('number')} /></th>
            <th scope="col" aria-sort={ariaSortOf(h.sort, 'date')}><SortButton label="Issued" direction={ariaSortOf(h.sort, 'date')} onClick={() => h.onSort('date')} /></th>
            <th scope="col" aria-sort={ariaSortOf(h.sort, 'type')}><SortButton label="Type" direction={ariaSortOf(h.sort, 'type')} onClick={() => h.onSort('type')} /></th>
            <th scope="col" className="inv-num-col" aria-sort={ariaSortOf(h.sort, 'amount')}><SortButton label="Total" align="right" direction={ariaSortOf(h.sort, 'amount')} onClick={() => h.onSort('amount')} /></th>
            <th scope="col" className="inv-col-actions"><span className="sr-only-text">Actions</span></th>
          </tr>
        </thead>
        <tbody onKeyDown={onKeyDown}>
          {rows.map((inv) => {
            const number = inv.invoice.invoiceNumber;
            return (
              <tr
                key={inv.id}
                data-row-id={inv.id}
                data-checked={h.selected.includes(inv.id) ? 'true' : undefined}
                className="inv-row"
                onFocus={() => setActiveId(inv.id)}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
                  h.onOpen(inv, (e.currentTarget as HTMLElement).querySelector<HTMLElement>('.inv-num'));
                }}
              >
                <td className="inv-col-select"><SelectBox inv={inv} h={h} /></td>
                <th scope="row" className="inv-cell-main">
                  <Button variant="link" className="inv-num print-keep" onClick={(e) => h.onOpen(inv, e.currentTarget)}>{number}</Button>
                  <span className="inv-file">{inv.filename}</span>
                </th>
                <td className="inv-cell-date">{fmtDate(inv.invoice.issueDate)}</td>
                <td><TypeBadge invoice={inv} /></td>
                <td className="inv-num-col">{fmtMoney(inv.invoice.totals.grossTotal, inv.invoice.currency || 'PLN')}</td>
                <td className="inv-col-actions"><RowMenu number={number} onOpen={() => h.onOpen(inv, null)} onEdit={() => h.onEdit(inv)} onDelete={() => h.onDelete(inv)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Phones (< 640 px): one card per invoice (plan §4.3). */
export function InvoiceCardList({ rows, h }: { rows: StoredInvoice[]; h: InvoiceListHandlers }) {
  return (
    <ul className="inv-cards" aria-label={`Invoices, ${rows.length} shown`}>
      {rows.map((inv) => {
        const number = inv.invoice.invoiceNumber;
        return (
          <li key={inv.id} className="inv-card" data-checked={h.selected.includes(inv.id) ? 'true' : undefined}>
            <div className="inv-card-select"><SelectBox inv={inv} h={h} /></div>
            <div className="inv-card-top">
              <Button variant="link" className="inv-num print-keep" onClick={(e) => h.onOpen(inv, e.currentTarget)}>{number}</Button>
              <span className="inv-card-total">{fmtMoney(inv.invoice.totals.grossTotal, inv.invoice.currency || 'PLN')}</span>
            </div>
            <div className="inv-card-meta">
              <span>{fmtDate(inv.invoice.issueDate)}</span>
              <TypeBadge invoice={inv} />
            </div>
            <div className="inv-card-actions"><RowMenu number={number} onOpen={() => h.onOpen(inv, null)} onEdit={() => h.onEdit(inv)} onDelete={() => h.onDelete(inv)} /></div>
            <span className="inv-file inv-card-file">{inv.filename}</span>
          </li>
        );
      })}
    </ul>
  );
}
