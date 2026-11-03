import type { StoredInvoice } from './storage';

export function toJson(invoices: StoredInvoice[]): string {
  return JSON.stringify(invoices, null, 2);
}

export function toCsv(adjustedInvoices: StoredInvoice[]): string {
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

export function toExcelCsv(adjustedInvoices: StoredInvoice[]): string {
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
