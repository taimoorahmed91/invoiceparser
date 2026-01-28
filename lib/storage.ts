import { ParsedInvoice, InvoiceType } from './parseInvoice';

export interface StoredInvoice {
  id: string;
  filename: string;
  parsedAt: string;
  invoice: ParsedInvoice;
}

const STORAGE_KEY = 'invoice-parser-data';
const MANUAL_VALUES_KEY = 'invoice-parser-manual-values';

export function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Migrate old invoices that don't have invoiceType
function migrateInvoice(invoice: ParsedInvoice): ParsedInvoice {
  if (!invoice.invoiceType) {
    const descriptions = invoice.lineItems.map(item => item.description.toLowerCase());
    const hasUtility = descriptions.some(d =>
      ['cold water', 'hot water', 'central heating', 'electricity', 'waste management'].includes(d)
    );
    const hasParking = descriptions.some(d => d.includes('parking'));
    const hasRent = descriptions.some(d => d === 'rent');

    let invoiceType: InvoiceType = 'Other';
    if (hasUtility) invoiceType = 'Utility';
    else if (hasParking) invoiceType = 'Parking';
    else if (hasRent) invoiceType = 'Rent';

    return { ...invoice, invoiceType };
  }
  return invoice;
}

export function loadInvoices(): StoredInvoice[] {
  if (typeof window === 'undefined') return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const invoices: StoredInvoice[] = JSON.parse(data);
    // Migrate old invoices
    return invoices.map(stored => ({
      ...stored,
      invoice: migrateInvoice(stored.invoice),
    }));
  } catch {
    return [];
  }
}

export function saveInvoices(invoices: StoredInvoice[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
  } catch (err) {
    console.error('Failed to save invoices:', err);
  }
}

export function addInvoice(filename: string, invoice: ParsedInvoice): StoredInvoice {
  const stored: StoredInvoice = {
    id: generateId(),
    filename,
    parsedAt: new Date().toISOString(),
    invoice,
  };

  const existing = loadInvoices();
  existing.unshift(stored);
  saveInvoices(existing);

  return stored;
}

export function deleteInvoice(id: string): void {
  const invoices = loadInvoices().filter((inv) => inv.id !== id);
  saveInvoices(invoices);
}

export function clearAllInvoices(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function exportToJson(invoices: StoredInvoice[]): string {
  return JSON.stringify(invoices, null, 2);
}

export function importFromJson(jsonString: string): StoredInvoice[] {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) {
      throw new Error('Invalid format: expected an array');
    }
    return data;
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

// Manual values storage (month -> value mapping)
export function loadManualValues(): Record<string, number> {
  if (typeof window === 'undefined') return {};

  try {
    const data = localStorage.getItem(MANUAL_VALUES_KEY);
    if (!data) return {};
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveManualValues(values: Record<string, number>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(MANUAL_VALUES_KEY, JSON.stringify(values));
  } catch (err) {
    console.error('Failed to save manual values:', err);
  }
}

export function setManualValue(month: string, value: number): void {
  const values = loadManualValues();
  values[month] = value;
  saveManualValues(values);
}

export function getManualValue(month: string): number {
  const values = loadManualValues();
  return values[month] || 0;
}
