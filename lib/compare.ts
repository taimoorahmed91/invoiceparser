/**
 * Compare two invoices (plan §4.5, F17). Pure. The numbers are exactly the ones the old comparison view worked out:
 *  - totals (net, tax, gross): difference = B − A, percentage of A (none when A is 0)
 *  - line items matched by their description (lower-cased, trimmed); a description that is on one side only is "Only in A" / "Only in B"
 *  - for a matched pair: gross, unit price and quantity differences, quantity percentage of A
 * One thing is kept on purpose from the old view: when an invoice has several lines with the same description (the three "Rent" lines of a
 * combined invoice) only the last of them takes part, as before. `collapsed` says how many lines that hid, so the screen can say so.
 */
import type { DataRow, TableSpec } from './dataView';
import { fmtDelta, fmtDeltaWith, fmtMoney, fmtNumber, fmtQuantity, type Delta } from './format';
import type { LineItem, ParsedInvoice } from './parseInvoice';

export type TotalKey = 'netTotal' | 'taxTotal' | 'grossTotal';
export const TOTAL_LABELS: Record<TotalKey, string> = { netTotal: 'Net', taxTotal: 'VAT', grossTotal: 'Total' };
const TOTAL_KEYS: TotalKey[] = ['netTotal', 'taxTotal', 'grossTotal'];

export interface TotalsRow {
  key: TotalKey;
  label: string;
  a: number;
  b: number;
  /** b − a */
  diff: number;
  /** diff as a percentage of a; null when a is 0 (the old view printed 0.0 there) */
  percent: number | null;
}

export type LineStatus = 'both' | 'onlyA' | 'onlyB';

export interface LineMatch {
  /** the normalised description the two sides were matched on */
  key: string;
  /** the description as written (A's, else B's) */
  description: string;
  status: LineStatus;
  a: LineItem | null;
  b: LineItem | null;
  /** Differences exist only for a matched pair (status "both"). b − a. */
  grossDiff: number | null;
  unitPriceDiff: number | null;
  quantityDiff: number | null;
  /** quantityDiff as a percentage of a's quantity; null when that is 0 */
  quantityPercent: number | null;
}

export interface Comparison {
  totals: TotalsRow[];
  lines: LineMatch[];
  counts: Record<LineStatus, number>;
  /** Both invoices use the same currency, so a difference is a meaningful number. */
  sameCurrency: boolean;
  currencyA: string;
  currencyB: string;
  /** Lines that did not take part because another line of the same invoice has the same description. */
  collapsed: number;
}

export const normalizeDescription = (d: string) => d.toLowerCase().trim();

export function compareInvoices(a: ParsedInvoice, b: ParsedInvoice): Comparison {
  const totals = TOTAL_KEYS.map((key): TotalsRow => {
    const va = a.totals[key];
    const vb = b.totals[key];
    const diff = vb - va;
    return { key, label: TOTAL_LABELS[key], a: va, b: vb, diff, percent: va !== 0 ? (diff / va) * 100 : null };
  });

  const mapA = new Map(a.lineItems.map((item) => [normalizeDescription(item.description), item]));
  const mapB = new Map(b.lineItems.map((item) => [normalizeDescription(item.description), item]));
  const keys = new Set([...a.lineItems.map((i) => normalizeDescription(i.description)), ...b.lineItems.map((i) => normalizeDescription(i.description))]);

  const lines: LineMatch[] = [];
  keys.forEach((key) => {
    const ia = mapA.get(key) || null;
    const ib = mapB.get(key) || null;
    const description = ia?.description || ib?.description || key;
    if (ia && ib) {
      const quantityDiff = ib.quantity - ia.quantity;
      lines.push({
        key, description, status: 'both', a: ia, b: ib,
        grossDiff: ib.grossValue - ia.grossValue,
        unitPriceDiff: ib.netPrice - ia.netPrice,
        quantityDiff,
        quantityPercent: ia.quantity !== 0 ? (quantityDiff / ia.quantity) * 100 : null,
      });
    } else {
      lines.push({ key, description, status: ia ? 'onlyA' : 'onlyB', a: ia, b: ib, grossDiff: null, unitPriceDiff: null, quantityDiff: null, quantityPercent: null });
    }
  });

  const counts: Record<LineStatus, number> = { both: 0, onlyA: 0, onlyB: 0 };
  lines.forEach((l) => counts[l.status]++);
  return {
    totals,
    lines,
    counts,
    sameCurrency: (a.currency || 'PLN') === (b.currency || 'PLN'),
    currencyA: a.currency || 'PLN',
    currencyB: b.currency || 'PLN',
    collapsed: a.lineItems.length - mapA.size + (b.lineItems.length - mapB.size),
  };
}

/* ---------- display text ---------- */

/** "▲ +123,40 zł · +4,2 %" for B compared with A (§4.0). Costs: up is the "bad" direction; the colour is chosen by the caller. */
export function totalDelta(row: TotalsRow, currency: string): Delta {
  return fmtDelta(row.b, row.a, currency);
}

export const grossDelta = (m: LineMatch, currency: string): Delta | null => (m.status === 'both' && m.a && m.b ? fmtDelta(m.b.grossValue, m.a.grossValue, currency) : null);
export const unitPriceDelta = (m: LineMatch, currency: string): Delta | null => (m.status === 'both' && m.a && m.b ? fmtDelta(m.b.netPrice, m.a.netPrice, currency) : null);
export const quantityDelta = (m: LineMatch): Delta | null => (m.status === 'both' && m.a && m.b ? fmtDeltaWith(m.b.quantity, m.a.quantity, (n) => fmtNumber(n, 3)) : null);

export const statusLabel = (s: LineStatus): string => (s === 'onlyA' ? 'Only in A' : s === 'onlyB' ? 'Only in B' : 'In both');

/* ---------- tables for Export (CSV / PDF) ---------- */

/** Net / VAT / Total for A and B and the difference, as a table. */
export function totalsSpec(c: Comparison): TableSpec {
  const money = (cur: string) => (v: unknown) => (typeof v === 'number' ? fmtMoney(v, cur) : '');
  return {
    columns: [
      { key: 'item', label: 'Amount', align: 'left' },
      { key: 'a', label: 'A', align: 'right', format: money(c.currencyA) },
      { key: 'b', label: 'B', align: 'right', format: money(c.currencyB) },
      { key: 'delta', label: 'Difference (B − A)', align: 'right' },
    ],
    rows: c.totals.map((t): DataRow => ({ item: t.label, a: t.a, b: t.b, delta: c.sameCurrency ? totalDelta(t, c.currencyA).text : '—' })),
  };
}

/** Every line with what each side has, and the gross difference, as a table. */
export function linesSpec(c: Comparison): TableSpec {
  const side = (item: LineItem | null, cur: string) => ({
    qty: item ? fmtQuantity(item.quantity, item.unit) : '',
    price: item ? item.netPrice : null,
    gross: item ? item.grossValue : null,
    cur,
  });
  const a = (m: LineMatch) => side(m.a, c.currencyA);
  const b = (m: LineMatch) => side(m.b, c.currencyB);
  const money = (cur: string) => (v: unknown) => (typeof v === 'number' ? fmtMoney(v, cur) : '');
  return {
    wide: true,
    columns: [
      { key: 'description', label: 'Description', align: 'left' },
      { key: 'in', label: 'Found in', align: 'left' },
      { key: 'aQty', label: 'A qty', align: 'right' },
      { key: 'aPrice', label: 'A unit price', align: 'right', format: money(c.currencyA) },
      { key: 'aGross', label: 'A gross', align: 'right', format: money(c.currencyA) },
      { key: 'bQty', label: 'B qty', align: 'right' },
      { key: 'bPrice', label: 'B unit price', align: 'right', format: money(c.currencyB) },
      { key: 'bGross', label: 'B gross', align: 'right', format: money(c.currencyB) },
      { key: 'delta', label: 'Difference (gross)', align: 'right' },
    ],
    rows: c.lines.map((m): DataRow => ({
      description: m.description,
      in: statusLabel(m.status),
      aQty: a(m).qty, aPrice: a(m).price, aGross: a(m).gross,
      bQty: b(m).qty, bPrice: b(m).price, bGross: b(m).gross,
      delta: c.sameCurrency ? grossDelta(m, c.currencyA)?.text ?? '' : '',
    })),
  };
}
