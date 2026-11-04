import type { StoredInvoice } from './storage';
import { getMonthYearFromDate, monthNames } from './dates';
import { UTILITY_CATEGORIES, matchesUtilityCategory, isManualRow, isParkingLine } from './categories';

// Split an invoice's gross amount by type. Since 2026, rent and parking can share
// one invoice, so when parking line items sit on a Rent invoice, move them to Parking.
export function amountsByType(invoice: StoredInvoice['invoice']): { Rent: number; Parking: number; Utility: number } {
  const result = { Rent: 0, Parking: 0, Utility: 0 };
  const type = invoice.invoiceType;
  if (type !== 'Rent' && type !== 'Parking' && type !== 'Utility') return result;
  const parkingGross = type === 'Rent'
    ? invoice.lineItems
        .filter((item) => isParkingLine(item.description))
        .reduce((sum, item) => sum + (item.grossValue ?? 0), 0)
    : 0;
  result[type] = invoice.totals.grossTotal - parkingGross;
  result.Parking += parkingGross;
  return result;
}

export function monthlyTotals(invoices: StoredInvoice[]) {
    const monthlyData: Record<string, { month: string; Rent: number; Parking: number; Utility: number }> = {};

    invoices.forEach((inv) => {
      const monthYear = getMonthYearFromDate(inv.invoice.issueDate);
      const amounts = amountsByType(inv.invoice);

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { month: monthYear, Rent: 0, Parking: 0, Utility: 0 };
      }

      monthlyData[monthYear].Rent += amounts.Rent;
      monthlyData[monthYear].Parking += amounts.Parking;
      monthlyData[monthYear].Utility += amounts.Utility;
    });

    // Sort by date
    return Object.values(monthlyData).sort((a, b) => {
      const [aMonth, aYear] = a.month.split(' ');
      const [bMonth, bYear] = b.month.split(' ');
      const aIndex = monthNames.indexOf(aMonth);
      const bIndex = monthNames.indexOf(bMonth);
      if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
      return aIndex - bIndex;
    });
}

export function yoySeries(invoices: StoredInvoice[]) {
    const byMonthYear: Record<string, Record<string, { Rent: number; Parking: number; Utility: number }>> = {};
    
    invoices.forEach((inv) => {
      const monthYear = getMonthYearFromDate(inv.invoice.issueDate);
      const [month, year] = monthYear.split(' ');
      const amounts = amountsByType(inv.invoice);

      if (!byMonthYear[month]) {
        byMonthYear[month] = {};
      }
      if (!byMonthYear[month][year]) {
        byMonthYear[month][year] = { Rent: 0, Parking: 0, Utility: 0 };
      }

      byMonthYear[month][year].Rent += amounts.Rent;
      byMonthYear[month][year].Parking += amounts.Parking;
      byMonthYear[month][year].Utility += amounts.Utility;
    });

    return byMonthYear;
}

export type UtilityMetric = 'gross' | 'quantity' | 'unitPrice';

export function utilitySeries(invoices: StoredInvoice[], allMonths: string[], metric: UtilityMetric) {
  return UTILITY_CATEGORIES.map(cat => {
    const valuesByMonth: Record<string, number> = {};
    const pricesByMonth: Record<string, { total: number; count: number }> = {};
    invoices.forEach(inv => {
      const month = getMonthYearFromDate(inv.invoice.issueDate);
      inv.invoice.lineItems.forEach(item => {
        if (!matchesUtilityCategory(item.description, cat.key) || isManualRow(item.description)) return;
        if (metric === 'unitPrice') {
          if (!pricesByMonth[month]) pricesByMonth[month] = { total: 0, count: 0 };
          const quantity = item.quantity ?? 0;
          const grossValue = item.grossValue ?? 0;
          if (quantity > 0) {
            pricesByMonth[month].total += grossValue / quantity;
            pricesByMonth[month].count += 1;
          }
        } else {
          valuesByMonth[month] = (valuesByMonth[month] || 0) +
            (metric === 'gross' ? (item.grossValue ?? 0) : (item.quantity ?? 0));
        }
      });
    });
    return allMonths.map((month, index) => {
      const data = pricesByMonth[month];
      return {
        month,
        value: metric === 'unitPrice'
          ? (data && data.count > 0 ? data.total / data.count : 0)
          : valuesByMonth[month] || 0,
        fullLabel: month,
        name: month,
        index,
      };
    });
  });
}
