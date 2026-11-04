/**
 * Everything the invoice drawer needs that is not drawing (plan §4.4). Pure.
 *  - the `?invoice=<id>` deep link: reading it, building it, keeping the list's own filters in the query
 *  - which stored fields are shown (empty ones are left out, not shown as "-")
 *  - the line items as a table for Export / PDF, and the neighbours for Prev / Next
 */
import type { LineItemView } from './adjustments';
import type { DataRow, TableSpec } from './dataView';
import { fmtDate, fmtMoney, fmtQuantity } from './format';
import type { ParsedInvoice } from './parseInvoice';

export const DRAWER_PARAM = 'invoice';

/** The deep link to one invoice's drawer on the Invoices page (Overview rows, Upload "Open" / "Review"). */
export function invoiceHref(id: string): string {
  return `/invoices?${DRAWER_PARAM}=${encodeURIComponent(id)}`;
}

export function readDrawerId(search: string): string | null {
  const id = new URLSearchParams(search).get(DRAWER_PARAM);
  return id ? id : null;
}

/**
 * The query string (no "?") with `invoice` set to `id` or removed, every other key (the list's filters) kept as it was.
 * `search` may start with "?".
 */
export function withDrawerParam(search: string, id: string | null): string {
  const params = new URLSearchParams(search);
  if (id) params.set(DRAWER_PARAM, id);
  else params.delete(DRAWER_PARAM);
  return params.toString();
}

/** True when the text holds a Polish letter, so it can be marked lang="pl" (right hyphenation and screen-reader voice). */
export function hasPolish(text: string): boolean {
  return /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text);
}

export interface DetailField {
  label: string;
  value: string;
  /** Offer a Copy button for this value. */
  copy?: boolean;
  mono?: boolean;
}

export interface DetailGroups {
  dates: DetailField[];
  payment: DetailField[];
  seller: DetailField[];
  purchaser: DetailField[];
}

const present = (label: string, value: string | undefined | null, extra: Partial<DetailField> = {}): DetailField[] => {
  const v = (value ?? '').trim();
  return v ? [{ label, value: v, ...extra }] : [];
};

/** The stored fields the old screen never showed (F28b). Empty values are left out. */
export function detailGroups(inv: ParsedInvoice): DetailGroups {
  const date = (label: string, d: string) => present(label, d ? fmtDate(d) : '');
  return {
    dates: [...date('Issued', inv.issueDate), ...date('Sale date', inv.saleDate), ...date('Due date', inv.dueDate)],
    payment: [...present('Payment method', inv.payment?.method), ...present('Bank account', inv.payment?.accountNumber, { copy: true, mono: true })],
    seller: [...present('Name', inv.seller?.name), ...present('Address', inv.seller?.address), ...present('NIP', inv.seller?.nip, { mono: true })],
    purchaser: [...present('Name', inv.purchaser?.name), ...present('Address', inv.purchaser?.address)],
  };
}

/** The line items as shown (heating adjustment and the added manual row included) as a table, for Export → CSV / PDF. */
export function lineItemsSpec(view: LineItemView, currency: string): TableSpec {
  const money = (v: unknown) => (typeof v === 'number' ? fmtMoney(v, currency) : '');
  const rows: DataRow[] = view.rows.map(({ item, kind }) => ({
    no: item.no,
    description: kind === 'manual' ? `${item.description} (added manually)` : kind === 'adjusted' ? `${item.description} (adjusted)` : item.description,
    quantity: fmtQuantity(item.quantity, item.unit),
    unitPrice: item.netPrice,
    net: item.netValue,
    tax: item.tax,
    gross: item.grossValue,
  }));
  return {
    wide: true,
    columns: [
      { key: 'no', label: '#', align: 'left' },
      { key: 'description', label: 'Description', align: 'left' },
      { key: 'quantity', label: 'Qty', align: 'right' },
      { key: 'unitPrice', label: 'Unit price', align: 'right', format: money },
      { key: 'net', label: 'Net', align: 'right', format: money },
      { key: 'tax', label: 'Tax', align: 'right' },
      { key: 'gross', label: 'Gross', align: 'right', format: money },
    ],
    rows,
  };
}

export interface Neighbours {
  /** 1-based position in the list, 0 when the invoice is not in it (a filter hides it). */
  position: number;
  count: number;
  prevId: string | null;
  nextId: string | null;
}

/** Prev / Next step through the list as it is shown (filtered and sorted). */
export function neighbours(rowIds: readonly string[], id: string): Neighbours {
  const i = rowIds.indexOf(id);
  if (i < 0) return { position: 0, count: rowIds.length, prevId: null, nextId: null };
  return { position: i + 1, count: rowIds.length, prevId: i > 0 ? rowIds[i - 1] : null, nextId: i < rowIds.length - 1 ? rowIds[i + 1] : null };
}

/** Where focus goes after the invoice at `id` was removed from the list: the one now in its place, else the one before it. */
export function neighbourAfterRemove(rowIds: readonly string[], id: string): string | null {
  const i = rowIds.indexOf(id);
  if (i < 0) return null;
  return rowIds[i + 1] ?? rowIds[i - 1] ?? null;
}
