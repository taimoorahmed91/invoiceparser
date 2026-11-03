// FROZEN Phase 0 baseline, copied from app/page.tsx before extraction.
// Bodies below are verbatim; only hook/closure wrappers became explicit parameters.
// Do not refactor or import production calculation helpers into this oracle.
import type { StoredInvoice } from '../lib/storage';
import type { LineItem } from '../lib/parseInvoice';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getMonthFromDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length >= 2) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return monthNames[monthIndex];
    }
  }
  return '-';
}

export function getMonthYearFromDate(dateStr: string): string {
  const parts = dateStr.split('/');
  if (parts.length >= 3) {
    const monthIndex = parseInt(parts[1], 10) - 1;
    const year = parts[2];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]} ${year}`;
    }
  }
  return 'Unknown';
}

// Split an invoice's gross amount by type. Since 2026, rent and parking can share
// one invoice, so when parking line items sit on a Rent invoice, move them to Parking.
export function amountsByType(invoice: StoredInvoice['invoice']): { Rent: number; Parking: number; Utility: number } {
  const result = { Rent: 0, Parking: 0, Utility: 0 };
  const type = invoice.invoiceType;
  if (type !== 'Rent' && type !== 'Parking' && type !== 'Utility') return result;
  const parkingGross = type === 'Rent'
    ? invoice.lineItems
        .filter((item) => item.description.toLowerCase().includes('parking'))
        .reduce((sum, item) => sum + (item.grossValue ?? 0), 0)
    : 0;
  result[type] = invoice.totals.grossTotal - parkingGross;
  result.Parking += parkingGross;
  return result;
}

export const utilityCategories = [
    { key: 'Cold Water', color: '#3b82f6', label: 'Cold Water' },
    { key: 'Hot Water', color: '#fb923c', label: 'Hot Water' },
    { key: 'Electricity', color: '#f59e42', label: 'Electricity' },
    { key: 'Central Heating', color: '#10b981', label: 'Central Heating' },
    { key: 'Waste Management', color: '#6366f1', label: 'Waste Management' },
  ];

export const parseDate = (dateStr: string): Date | null => {
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        return new Date(year, month, day);
      }
    }
    return null;
  };

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


export function rentalSeries(chartData: ReturnType<typeof monthlyTotals>, allMonths: string[]) {
    const dataMap = new Map(
      chartData.map((item) => [
        item.month,
        {
          month: item.month, // Use full month-year as unique key
          value: item.Rent,
          fullLabel: item.month,
        },
      ])
    );

    return allMonths.map((month, index) => {
      const existing = dataMap.get(month);
      const dataPoint = existing || {
        month: month, // Use full month-year as unique key
        value: 0,
        fullLabel: month,
      };
      return {
        ...dataPoint,
        index: index,
        name: month,
      };
    });
}


export function utilityTypeSeries(chartData: ReturnType<typeof monthlyTotals>, allMonths: string[]) {
    const dataMap = new Map(
      chartData.map((item) => [
        item.month,
        {
          month: item.month, // Use full month-year as unique key
          value: item.Utility,
          fullLabel: item.month,
        },
      ])
    );

    return allMonths.map((month, index) => {
      const existing = dataMap.get(month);
      const dataPoint = existing || {
        month: month, // Use full month-year as unique key
        value: 0,
        fullLabel: month,
      };
      return { ...dataPoint, name: month, index };
    });
}


export function parkingSeries(chartData: ReturnType<typeof monthlyTotals>, allMonths: string[]) {
    const dataMap = new Map(
      chartData.map((item) => [
        item.month,
        {
          month: item.month, // Use full month-year as unique key
          value: item.Parking,
          fullLabel: item.month,
        },
      ])
    );

    return allMonths.map((month, index) => {
      const existing = dataMap.get(month);
      const dataPoint = existing || {
        month: month, // Use full month-year as unique key
        value: 0,
        fullLabel: month,
      };
      return { ...dataPoint, name: month, index };
    });
}


export function utilityGrossSeries(invoices: StoredInvoice[], allMonths: string[]) {
    return utilityCategories.map(cat => {
      const valuesByMonth: Record<string, number> = {};
      invoices.forEach(inv => {
        const month = getMonthYearFromDate(inv.invoice.issueDate);
        inv.invoice.lineItems.forEach(item => {
          const descLower = item.description.toLowerCase();
          let matches = false;
          
          // Match based on keywords for each category
          if (cat.key === 'Cold Water') {
            matches = descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
          } else if (cat.key === 'Hot Water') {
            matches = descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
          } else if (cat.key === 'Electricity') {
            matches = descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
          } else if (cat.key === 'Central Heating') {
            matches = descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
          } else if (cat.key === 'Waste Management') {
            matches = descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
          }
          
          if (matches) {
            // Exclude "Manual Heating Calculation" rows from graphs
            if (descLower.includes('manual heating calculation') || descLower.includes('manual calculation')) {
              return;
            }
            valuesByMonth[month] = (valuesByMonth[month] || 0) + (item.grossValue ?? 0);
          }
        });
      });
      return allMonths.map((month, index) => ({
        month: month, // Use full month-year as unique key
        value: valuesByMonth[month] || 0,
        fullLabel: month,
        name: month,
        index,
      }));
    });
}


export function utilityQuantitySeries(invoices: StoredInvoice[], allMonths: string[]) {
    return utilityCategories.map(cat => {
      const valuesByMonth: Record<string, number> = {};
      invoices.forEach(inv => {
        const month = getMonthYearFromDate(inv.invoice.issueDate);
        inv.invoice.lineItems.forEach(item => {
          const descLower = item.description.toLowerCase();
          let matches = false;

          // Match based on keywords for each category
          if (cat.key === 'Cold Water') {
            matches = descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
          } else if (cat.key === 'Hot Water') {
            matches = descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
          } else if (cat.key === 'Electricity') {
            matches = descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
          } else if (cat.key === 'Central Heating') {
            matches = descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
          } else if (cat.key === 'Waste Management') {
            matches = descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
          }

          if (matches) {
            // Exclude "Manual Heating Calculation" rows from graphs
            if (descLower.includes('manual heating calculation') || descLower.includes('manual calculation')) {
              return;
            }
            valuesByMonth[month] = (valuesByMonth[month] || 0) + (item.quantity ?? 0);
          }
        });
      });
      return allMonths.map((month, index) => ({
        month: month, // Use full month-year as unique key
        value: valuesByMonth[month] || 0,
        fullLabel: month,
        name: month,
        index,
      }));
    });
}


export function utilityUnitPriceSeries(invoices: StoredInvoice[], allMonths: string[]) {
    return utilityCategories.map(cat => {
      const valuesByMonth: Record<string, { total: number; count: number }> = {};
      invoices.forEach(inv => {
        const month = getMonthYearFromDate(inv.invoice.issueDate);
        inv.invoice.lineItems.forEach(item => {
          const descLower = item.description.toLowerCase();
          let matches = false;
          
          // Match based on keywords for each category
          if (cat.key === 'Cold Water') {
            matches = descLower === 'cold water' || descLower.includes('zimnej wody') || descLower.includes('cold water');
          } else if (cat.key === 'Hot Water') {
            matches = descLower === 'hot water' || descLower.includes('ciepłej wody') || descLower.includes('hot water');
          } else if (cat.key === 'Electricity') {
            matches = descLower === 'electricity' || descLower.includes('energii elektrycznej') || descLower.includes('electricity');
          } else if (cat.key === 'Central Heating') {
            matches = descLower === 'central heating' || descLower.includes('ciepła') || descLower.includes('heating');
          } else if (cat.key === 'Waste Management') {
            matches = descLower.includes('odpadami') || descLower.includes('waste') || descLower.includes('gospodarka odpadami');
          }
          
          if (matches) {
            // Exclude "Manual Heating Calculation" rows from graphs
            if (descLower.includes('manual heating calculation') || descLower.includes('manual calculation')) {
              return;
            }
            
            if (!valuesByMonth[month]) {
              valuesByMonth[month] = { total: 0, count: 0 };
            }
            // Calculate unit price: grossValue / quantity
            const quantity = item.quantity ?? 0;
            const grossValue = item.grossValue ?? 0;
            if (quantity > 0) {
              const unitPrice = grossValue / quantity;
              valuesByMonth[month].total += unitPrice;
              valuesByMonth[month].count += 1;
            }
          }
        });
      });
      return allMonths.map((month, index) => {
        const data = valuesByMonth[month];
        const avgPrice = data && data.count > 0 ? data.total / data.count : 0;
        return {
          month: month, // Use full month-year as unique key
          value: avgPrice,
          fullLabel: month,
          name: month,
          index,
        };
      });
    });
}


export function applyManualAdjustments(invoicesToAdjust: StoredInvoice[], manualValues: Record<string, number>) {
    return invoicesToAdjust.map(stored => {
      // Only apply to Utility invoices
      if (stored.invoice.invoiceType !== 'Utility') {
        return stored;
      }

      const monthYear = getMonthYearFromDate(stored.invoice.issueDate);
      const manualValue = manualValues[monthYear] || 0;

      // If no manual value, return as-is
      if (manualValue <= 0) {
        return stored;
      }

      const manualAdjustment = manualValue * 76;

      // Find Central Heating line item
      const centralHeatingIndex = stored.invoice.lineItems.findIndex(item =>
        item.description.toLowerCase() === 'central heating' ||
        item.description.toLowerCase().includes('central heating') ||
        item.description.toLowerCase().includes('ciepła')
      );

      // Create a copy of the invoice
      const adjustedInvoice = { ...stored.invoice };
      const adjustedLineItems = [...stored.invoice.lineItems];

      // Adjust Central Heating if found
      if (centralHeatingIndex >= 0) {
        const centralHeating = { ...adjustedLineItems[centralHeatingIndex] };
        centralHeating.grossValue = Math.max(0, centralHeating.grossValue - manualAdjustment);
        centralHeating.netValue = Math.max(0, centralHeating.netValue - manualAdjustment);
        
        // Recalculate netPrice based on adjusted grossValue
        if (centralHeating.quantity > 0) {
          centralHeating.netPrice = centralHeating.grossValue / centralHeating.quantity;
        }
        
        adjustedLineItems[centralHeatingIndex] = centralHeating;
      }

      // Add Manual Heating Calculation line item
      const manualLineItem: LineItem = {
        no: adjustedLineItems.length + 1,
        description: `Manual Heating Calculation (${manualValue} × 76)`,
        netPrice: manualAdjustment,
        quantity: 1,
        unit: 'UNIT',
        netValue: manualAdjustment,
        tax: '0%',
        grossValue: manualAdjustment,
      };
      adjustedLineItems.push(manualLineItem);

      // Update invoice with adjusted line items
      adjustedInvoice.lineItems = adjustedLineItems;

      // Recalculate totals (add and subtract cancel out, so total remains the same)
      const newNetTotal = adjustedLineItems.reduce((sum, item) => sum + item.netValue, 0);
      const newGrossTotal = adjustedLineItems.reduce((sum, item) => sum + item.grossValue, 0);
      const newTaxTotal = newGrossTotal - newNetTotal;

      adjustedInvoice.totals = {
        netTotal: newNetTotal,
        taxTotal: newTaxTotal,
        grossTotal: newGrossTotal,
      };

      return {
        ...stored,
        invoice: adjustedInvoice,
      };
    });
}


export function csvContent(adjustedInvoices: StoredInvoice[]) {
    // CSV header
    const headers = ['Invoice Number', 'Date', 'Type', 'Net Total', 'Tax Total', 'Gross Total', 'Currency', 'Filename'];
    const rows = adjustedInvoices.map(inv => [
      inv.invoice.invoiceNumber || '',
      inv.invoice.issueDate || '',
      inv.invoice.invoiceType || '',
      (inv.invoice.totals.netTotal || 0).toFixed(2),
      (inv.invoice.totals.taxTotal || 0).toFixed(2),
      (inv.invoice.totals.grossTotal || 0).toFixed(2),
      inv.invoice.currency || 'PLN',
      inv.filename || ''
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
  return BOM + csvContent;
}


export function excelContent(adjustedInvoices: StoredInvoice[]) {
    // Detailed CSV with line items
    const lines: string[] = [];
    
    // Summary sheet data
    lines.push('INVOICE SUMMARY');
    lines.push('');
    lines.push('Invoice Number,Date,Type,Net Total,Tax Total,Gross Total,Currency,Filename');
    adjustedInvoices.forEach(inv => {
      lines.push([
        inv.invoice.invoiceNumber || '',
        inv.invoice.issueDate || '',
        inv.invoice.invoiceType || '',
        (inv.invoice.totals.netTotal || 0).toFixed(2),
        (inv.invoice.totals.taxTotal || 0).toFixed(2),
        (inv.invoice.totals.grossTotal || 0).toFixed(2),
        inv.invoice.currency || 'PLN',
        inv.filename || ''
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });

    const csvContent = lines.join('\n');
    const BOM = '\uFEFF';
  return BOM + csvContent;
}

export function toJson(invoices: StoredInvoice[]): string {
  return JSON.stringify(invoices, null, 2);
}
