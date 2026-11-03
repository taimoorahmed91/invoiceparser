import type { StoredInvoice } from './storage';
import type { LineItem } from './parseInvoice';
import { getMonthYearFromDate } from './dates';
import { isHeatingRow } from './categories';

export const HEATING_RATE = 76;

export function applyManualAdjustments(invoicesToAdjust: StoredInvoice[], manualValues: Record<string, number>): StoredInvoice[] {
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

      const manualAdjustment = manualValue * HEATING_RATE;

      // Find Central Heating line item
      const centralHeatingIndex = stored.invoice.lineItems.findIndex(item =>
        isHeatingRow(item.description)
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
        description: `Manual Heating Calculation (${manualValue} × ${HEATING_RATE})`,
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
