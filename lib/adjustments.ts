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

/* ---------- what the invoice detail shows (plan §4.4, F29) ---------- */

export type LineItemKind = 'normal' | 'adjusted' | 'manual';

export interface LineItemRowView {
  /** What is shown: the stored line, or the heating line with the manual amount taken off, or the added manual line. */
  item: LineItem;
  /** The stored line (the added manual line has none). */
  original: LineItem | null;
  kind: LineItemKind;
  /** How much was really taken off the heating line's gross (adjusted rows only; less than the manual amount when the line was floored at 0). */
  reduction: number;
}

export interface LineItemView {
  rows: LineItemRowView[];
  /** manualValue × 76 (not rounded, like everywhere else). 0 without a manual value. */
  adjustment: number;
  /** The stored line items already contain a "Manual Heating Calculation" row: nothing is adjusted or added then. */
  hasStoredManualRow: boolean;
}

/**
 * The line items as the invoice detail has always shown them (components/LineItemTable.tsx before Phase 9), as plain data:
 *  - the first heating row (`isHeatingRow`) loses manualValue × 76 (gross and net, floored at 0; unit price = gross / quantity when quantity > 0)
 *  - a "Manual Heating Calculation (N × 76)" row is added at the end, 1 UNIT, 0 % tax
 *  - both are skipped when the stored items already hold a manual heating row
 * Nothing is written anywhere; the stored invoice is never touched.
 */
export function computeLineItemView(items: LineItem[], manualValue = 0): LineItemView {
  const adjustment = manualValue > 0 ? manualValue * HEATING_RATE : 0;
  const heatingIndex = items.findIndex(item => isHeatingRow(item.description));
  const hasStoredManualRow = items.some(item => item.description.toLowerCase().includes('manual heating calculation'));
  const active = manualValue > 0 && !hasStoredManualRow;

  const rows: LineItemRowView[] = items.map((item, idx) => {
    if (!(active && idx === heatingIndex)) return { item, original: item, kind: 'normal' as const, reduction: 0 };
    const grossValue = Math.max(0, item.grossValue - adjustment);
    const netValue = Math.max(0, item.netValue - adjustment);
    const netPrice = item.quantity > 0 ? grossValue / item.quantity : item.netPrice;
    return { item: { ...item, grossValue, netValue, netPrice }, original: item, kind: 'adjusted' as const, reduction: item.grossValue - grossValue };
  });

  if (active) {
    rows.push({
      item: {
        no: items.length + 1,
        description: `Manual Heating Calculation (${manualValue} × ${HEATING_RATE})`,
        netPrice: adjustment,
        quantity: 1,
        unit: 'UNIT',
        netValue: adjustment,
        tax: '0%',
        grossValue: adjustment,
      },
      original: null,
      kind: 'manual',
      reduction: 0,
    });
  }
  return { rows, adjustment, hasStoredManualRow };
}
