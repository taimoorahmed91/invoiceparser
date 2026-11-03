import type { InvoiceType } from './parseInvoice';
import type { StoredInvoice } from './storage';
import { getMonthYearFromDate, monthNames, parseDate } from './dates';

export interface Filters {
  filterType: InvoiceType | 'all';
  filterMonth: string;
  searchQuery: string;
  dateRangeStart: string;
  dateRangeEnd: string;
}
export function migrateLegacyFilters(filters: Filters): Filters {
  if (filters.filterMonth === 'all') return filters;
  const [month, year] = filters.filterMonth.split(' ');
  const index = monthNames.indexOf(month);
  if (index < 0 || !/^\d{4}$/.test(year)) return filters;
  const key = `${year}-${String(index + 1).padStart(2, '0')}`;
  // Keep the month selector and existing range intact on the legacy screen.
  // New period controls consume from/to; invalid-date legacy keys stay untouched.
  return { ...filters, dateRangeStart: filters.dateRangeStart || key, dateRangeEnd: filters.dateRangeEnd || key };
}

export function applyFilters(invoices: StoredInvoice[], { filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd }: Filters) {
  return invoices.filter(inv => {
    const typeMatch = filterType === 'all' || inv.invoice.invoiceType === filterType;
    const monthMatch = filterMonth === 'all' || getMonthYearFromDate(inv.invoice.issueDate) === filterMonth;
    const searchMatch = !searchQuery || inv.invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || inv.filename.toLowerCase().includes(searchQuery.toLowerCase());
    let dateRangeMatch = true;
    if (dateRangeStart || dateRangeEnd) {
      const date = parseDate(inv.invoice.issueDate);
      if (date) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (dateRangeStart && dateRangeStart.trim() !== '' && key < dateRangeStart) dateRangeMatch = false;
        if (dateRangeEnd && dateRangeEnd.trim() !== '' && key > dateRangeEnd) dateRangeMatch = false;
      }
    }
    return typeMatch && monthMatch && searchMatch && dateRangeMatch;
  });
}

export function sortInvoices(invoices: StoredInvoice[], field: 'date' | 'amount' | 'type' | 'number' | null, direction: 'asc' | 'desc') {
  if (!field) return invoices;
  return [...invoices].sort((a, b) => {
    let comparison = 0;
    if (field === 'date') {
      const left = parseDate(a.invoice.issueDate), right = parseDate(b.invoice.issueDate);
      if (!left || !right) return 0;
      comparison = left.getTime() - right.getTime();
    } else if (field === 'amount') comparison = a.invoice.totals.grossTotal - b.invoice.totals.grossTotal;
    else if (field === 'type') comparison = a.invoice.invoiceType.localeCompare(b.invoice.invoiceType);
    else comparison = a.invoice.invoiceNumber.localeCompare(b.invoice.invoiceNumber);
    return direction === 'asc' ? comparison : -comparison;
  });
}
