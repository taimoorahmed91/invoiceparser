/**
 * Where an Overview card or row leads (plan §4.2: "the whole card is a link to the relevant filtered Invoices view").
 * The URL is the deep link the Invoices page reads (filters, and `?invoice=` for the drawer). `filters` is also written to localStorage just
 * before a KPI link is followed, so the list opens the same way even if the URL is lost. Pure, except `storeLegacyFilters`.
 */
import { ymToMonthKey, type YearMonth } from './analyticsMonthly';
import type { KpiId } from './analyticsOverview';
import type { Filters } from './filters';
import { invoiceHref } from './invoiceDetail';
import type { StoredInvoice } from './storage';

export const LEGACY_FILTERS_KEY = 'invoice-parser-filters';

export interface InvoiceLink {
  href: string;
  filters: Filters;
}

const NONE: Filters = { filterType: 'all', filterMonth: 'all', searchQuery: '', dateRangeStart: '', dateRangeEnd: '' };

export function kpiLink(id: KpiId, period: YearMonth): InvoiceLink {
  if (id === 'ytd') {
    const from = `${period.slice(0, 4)}-01`;
    return { href: `/invoices?from=${from}&to=${period}`, filters: { ...NONE, dateRangeStart: from, dateRangeEnd: period } };
  }
  const month = ymToMonthKey(period);
  if (id === 'utility') return { href: `/invoices?month=${period}&type=Utility`, filters: { ...NONE, filterType: 'Utility', filterMonth: month } };
  return { href: `/invoices?month=${period}`, filters: { ...NONE, filterMonth: month } };
}

/**
 * A latest-invoice row, Upload "Open" / "Review": the Invoices page with that invoice's drawer open (`?invoice=<id>`, plan §4.4).
 * The list's own filters are left alone: nothing is written to localStorage for this link.
 */
export function invoiceLink(stored: StoredInvoice): { href: string } {
  return { href: invoiceHref(stored.id) };
}

export function storeLegacyFilters(filters: Filters): void {
  try {
    window.localStorage.setItem(LEGACY_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* private mode: the link still opens the list, just unfiltered */
  }
}

export const ALL_INVOICES: InvoiceLink = { href: '/invoices', filters: NONE };
