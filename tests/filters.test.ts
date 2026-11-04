import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/invoices.json';
import type { StoredInvoice } from '../lib/storage';
import { applyFilters, migrateLegacyFilters, type Filters } from '../lib/filters';
import { getMonthYearFromDate, parseDate } from '../lib/dates';

const invoices = fixtures as StoredInvoice[];
// Frozen legacy predicate, independent of production filters.
function legacy(invoices: StoredInvoice[], filters: Filters) {
  const { filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd } = filters;
  return invoices.filter(inv => {
    const typeMatch = filterType === 'all' || inv.invoice.invoiceType === filterType;
    const monthMatch = filterMonth === 'all' || getMonthYearFromDate(inv.invoice.issueDate) === filterMonth;
    const searchMatch = !searchQuery || inv.invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || inv.filename.toLowerCase().includes(searchQuery.toLowerCase());
    let dateRangeMatch = true;
    if (dateRangeStart || dateRangeEnd) {
      const invoiceDate = parseDate(inv.invoice.issueDate);
      if (invoiceDate) {
        const invoiceMonthYear = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
        if (dateRangeStart && dateRangeStart.trim() !== '') {
          if (invoiceMonthYear < dateRangeStart) dateRangeMatch = false;
        }
        if (dateRangeEnd && dateRangeEnd.trim() !== '') {
          if (invoiceMonthYear > dateRangeEnd) dateRangeMatch = false;
        }
      }
    }
    return typeMatch && monthMatch && searchMatch && dateRangeMatch;
  });
}
const defaults: Filters = { filterType: 'all', filterMonth: 'all', searchQuery: '', dateRangeStart: '', dateRangeEnd: '' };
describe('filter parity', () => {
  for (const filterType of ['all', 'Rent', 'Parking', 'Utility', 'Other'] as const) {
    for (const filterMonth of ['all', 'Jun 2025', 'Jan 2026', 'Unknown']) {
      it(`${filterType} / ${filterMonth}: search and range combinations equal legacy`, () => {
        for (const searchQuery of ['', 'FA/MYS', '.PDF', 'missing']) {
          for (const [dateRangeStart, dateRangeEnd] of [['', ''], ['2025-01', '2025-12'], ['', '2025-06'], ['2026-01', ''], [' ', ' ']]) {
            const filters = { filterType, filterMonth, searchQuery, dateRangeStart, dateRangeEnd };
            expect(applyFilters(invoices, filters)).toEqual(legacy(invoices, filters));
          }
        }
      });
    }
  }
  it('does not discard invalid invoice dates for range-only filters', () => {
    const invalid = [{ ...invoices[0], invoice: { ...invoices[0].invoice, issueDate: 'invalid' } }];
    expect(applyFilters(invalid, { ...defaults, dateRangeStart: '2026-01' })).toEqual(invalid);
  });
  it('migrates a legacy month to From = To, keeping stored month keys', () => {
    expect(migrateLegacyFilters({ ...defaults, filterMonth: 'Nov 2026' })).toEqual({ ...defaults, filterMonth: 'Nov 2026', dateRangeStart: '2026-11', dateRangeEnd: '2026-11' });
    expect(migrateLegacyFilters(defaults)).toBe(defaults);
    const unknown = { ...defaults, filterMonth: 'Unknown' };
    expect(migrateLegacyFilters(unknown)).toBe(unknown);
  });
  it('does not replace existing ranges during migration', () => {
    const filters = { ...defaults, filterMonth: 'Nov 2026', dateRangeStart: '2025-01', dateRangeEnd: '2025-12' };
    expect(migrateLegacyFilters(filters)).toEqual(filters);
  });
});
