/**
 * Sanity flags for a freshly parsed invoice (plan §4.6). Display-only: the invoice is saved exactly as parsed, the row just says
 * "Saved — check this one". These are the four ways a parse has gone wrong in practice: the Nov-2026 invoice had an empty issue date,
 * so its month showed "-" and nothing flagged it. Pure.
 */
import { getMonthYearFromDate } from './dates';
import type { ParsedInvoice } from './parseInvoice';

export type WarningCode = 'no-date' | 'unknown-number' | 'zero-total' | 'no-items';

export interface ParseWarning {
  code: WarningCode;
  /** Plain sentence for the row. */
  message: string;
}

export function parseWarnings(invoice: ParsedInvoice): ParseWarning[] {
  const out: ParseWarning[] = [];
  const number = (invoice.invoiceNumber ?? '').trim();
  if (number === '' || number === 'Unknown') {
    out.push({ code: 'unknown-number', message: 'No invoice number was found.' });
  }
  // an unreadable date has no month: charts and the month filter would show "-" / "Unknown"
  if (!invoice.issueDate || getMonthYearFromDate(invoice.issueDate) === 'Unknown') {
    out.push({ code: 'no-date', message: 'No issue date was found, so this invoice has no month.' });
  }
  const gross = invoice.totals?.grossTotal;
  if (typeof gross !== 'number' || !Number.isFinite(gross) || gross === 0) {
    out.push({ code: 'zero-total', message: 'The total is 0,00.' });
  }
  if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
    out.push({ code: 'no-items', message: 'No line items were found.' });
  }
  return out;
}
