/**
 * Where an Overview card or row leads (plan §4.2: "the whole card is a link to the relevant filtered Invoices view").
 * The URL is the deep link the Invoices page will read from Phase 8 on. Until then the current Invoices page restores its filters from
 * localStorage, so `legacyFilters` is what gets written just before the link is followed. Pure, except `storeLegacyFilters`.
 */
import { ymToMonthKey, type YearMonth } from './analyticsMonthly';
import type { KpiId } from './analyticsOverview';
import type { Filters } from './filters';
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

/** A latest-invoice row: the Invoices page filtered to that invoice's number (the drawer deep link `?invoice=` comes in Phase 9). */
export function invoiceLink(stored: StoredInvoice): InvoiceLink {
  return { href: `/invoices?q=${encodeURIComponent(stored.invoice.invoiceNumber)}`, filters: { ...NONE, searchQuery: stored.invoice.invoiceNumber } };
}

export function storeLegacyFilters(filters: Filters): void {
  try {
    window.localStorage.setItem(LEGACY_FILTERS_KEY, JSON.stringify(filters));
  } catch {
    /* private mode: the link still opens the list, just unfiltered */
  }
}

export const ALL_INVOICES: InvoiceLink = { href: '/invoices', filters: NONE };
