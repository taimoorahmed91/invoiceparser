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
  // An existing range wins; a month that is not a real month stays untouched (returned above).
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

