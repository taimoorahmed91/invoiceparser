import type { LineItem } from '../../lib/parseInvoice';
import type { StoredInvoice } from '../../lib/storage';

export function line(description: string, grossValue: number, quantity = 1): LineItem {
  return { no: 1, description, grossValue, quantity, netPrice: grossValue, netValue: grossValue, tax: '0%', unit: 'UNIT' };
}

export function invoice(lineItems: LineItem[], type: StoredInvoice['invoice']['invoiceType'] = 'Utility', issueDate = '03/11/2026'): StoredInvoice {
  const total = lineItems.reduce((sum, item) => sum + item.grossValue, 0);
  return {
    id: 'synthetic', filename: 'zażółć, "invoice"\n2026.pdf', parsedAt: '2026-11-03T00:00:00.000Z',
    invoice: {
      invoiceNumber: 'FA/MYS/124/11/2026', issueDate, saleDate: '', dueDate: '', invoiceType: type,
      seller: { name: '', address: '', nip: '' }, purchaser: { name: '', address: '' },
      payment: { method: '', accountNumber: '' }, currency: 'PLN', lineItems,
      totals: { netTotal: total, taxTotal: 0, grossTotal: total },
    },
  };
}

export const combinedInvoice = invoice([
  line('Rent', 2400), line('PARKING Rent', 123), line('Parking space 2', 77),
], 'Rent');

export const utilityInvoice = invoice([
  line('Cold Water', 25, 2), line('ZIMNEJ WODY', 60, 3),
  line('Hot Water', 40, 2), line('ciepłej wody', 12, 0),
  line('Electricity', 80, 4), line('energii elektrycznej', 10, -1),
  line('Central Heating', 200, 2), line('zaliczka ciepła', 100, 4),
  line('heating only', 30, 0), line('GOSPODARKA ODPADAMI', 50),
  line('Waste Management', 20), line('unmatched', 999),
  line('Manual Heating Calculation (2 × 76)', 152),
  line('Central Heating Manual Calculation', 76),
]);

export const manualCases: { name: string; values: Record<string, number>; stored: StoredInvoice }[] = [
  { name: 'missing', values: {}, stored: utilityInvoice },
  { name: 'zero', values: { 'Nov 2026': 0 }, stored: utilityInvoice },
  { name: 'negative', values: { 'Nov 2026': -2 }, stored: utilityInvoice },
  { name: 'fractional', values: { 'Nov 2026': 0.125 }, stored: utilityInvoice },
  { name: 'adjusted', values: { 'Nov 2026': 2 }, stored: invoice([line('Central Heating', 500, 2)]) },
  { name: 'floor at zero', values: { 'Nov 2026': 10 }, stored: invoice([line('Central Heating', 10, 0)]) },
  { name: 'already has manual row', values: { 'Nov 2026': 2 }, stored: utilityInvoice },
  { name: 'no heating row', values: { 'Nov 2026': 2 }, stored: invoice([line('Cold Water', 100)]) },
  { name: 'Polish heating row', values: { 'Nov 2026': 1 }, stored: invoice([line('zużycie ciepła', 200)]) },
  { name: 'embedded heating row', values: { 'Nov 2026': 1 }, stored: invoice([line('Advance CENTRAL HEATING', 200)]) },
  { name: 'chart-only heating match', values: { 'Nov 2026': 1 }, stored: invoice([line('heating only', 200)]) },
  { name: 'wrong month', values: { 'Oct 2026': 2 }, stored: utilityInvoice },
  { name: 'non-utility', values: { 'Nov 2026': 2 }, stored: combinedInvoice },
];
