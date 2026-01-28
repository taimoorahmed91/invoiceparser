import { ParsedInvoice, InvoiceType, LineItem } from './parseInvoice';
import { supabase } from './supabase';

export interface StoredInvoice {
  id: string;
  filename: string;
  parsedAt: string;
  invoice: ParsedInvoice;
}

export function generateId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper to convert database row to StoredInvoice
function dbRowToStoredInvoice(invoiceRow: any, lineItems: any[]): StoredInvoice {
  const invoice: ParsedInvoice = {
    invoiceNumber: invoiceRow.invoice_number || '',
    issueDate: invoiceRow.issue_date || '',
    saleDate: invoiceRow.sale_date || '',
    dueDate: invoiceRow.due_date || '',
    invoiceType: invoiceRow.invoice_type || 'Other',
    seller: {
      name: invoiceRow.seller_name || '',
      address: invoiceRow.seller_address || '',
      nip: invoiceRow.seller_nip || '',
    },
    purchaser: {
      name: invoiceRow.purchaser_name || '',
      address: invoiceRow.purchaser_address || '',
    },
    payment: {
      method: invoiceRow.payment_method || '',
      accountNumber: invoiceRow.payment_account_number || '',
    },
    lineItems: lineItems.map(item => ({
      no: item.item_no,
      description: item.description,
      netPrice: parseFloat(item.net_price) || 0,
      quantity: parseFloat(item.quantity) || 0,
      unit: item.unit || '',
      netValue: parseFloat(item.net_value) || 0,
      tax: item.tax || '0%',
      grossValue: parseFloat(item.gross_value) || 0,
    })),
    totals: {
      netTotal: parseFloat(invoiceRow.net_total) || 0,
      taxTotal: parseFloat(invoiceRow.tax_total) || 0,
      grossTotal: parseFloat(invoiceRow.gross_total) || 0,
    },
    currency: invoiceRow.currency || 'PLN',
  };

  return {
    id: invoiceRow.id,
    filename: invoiceRow.filename,
    parsedAt: invoiceRow.parsed_at,
    invoice,
  };
}

// Load all invoices from Supabase
export async function loadInvoices(): Promise<StoredInvoice[]> {
  try {
    // Fetch all invoices
    const { data: invoices, error: invoicesError } = await supabase
      .from('invoiceparser_invoices')
      .select('*')
      .order('parsed_at', { ascending: false });

    if (invoicesError) throw invoicesError;
    if (!invoices || invoices.length === 0) return [];

    // Fetch all line items for these invoices
    const invoiceIds = invoices.map(inv => inv.id);
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('invoiceparser_line_items')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('item_no', { ascending: true });

    if (lineItemsError) throw lineItemsError;

    // Group line items by invoice_id
    const lineItemsByInvoice: Record<string, any[]> = {};
    (lineItems || []).forEach(item => {
      if (!lineItemsByInvoice[item.invoice_id]) {
        lineItemsByInvoice[item.invoice_id] = [];
      }
      lineItemsByInvoice[item.invoice_id].push(item);
    });

    // Convert to StoredInvoice format
    return invoices.map(inv =>
      dbRowToStoredInvoice(inv, lineItemsByInvoice[inv.id] || [])
    );
  } catch (err) {
    console.error('Failed to load invoices:', err);
    return [];
  }
}

// Save invoices (bulk upsert) - not typically used, kept for compatibility
export async function saveInvoices(invoices: StoredInvoice[]): Promise<void> {
  try {
    for (const stored of invoices) {
      await addInvoice(stored.filename, stored.invoice, stored.id);
    }
  } catch (err) {
    console.error('Failed to save invoices:', err);
    throw err;
  }
}

// Add a single invoice to Supabase
export async function addInvoice(
  filename: string,
  invoice: ParsedInvoice,
  existingId?: string
): Promise<StoredInvoice> {
  const id = existingId || generateId();
  const parsedAt = new Date().toISOString();

  try {
    // Insert invoice
    const { error: invoiceError } = await supabase
      .from('invoiceparser_invoices')
      .upsert({
        id,
        filename,
        parsed_at: parsedAt,
        invoice_number: invoice.invoiceNumber,
        issue_date: invoice.issueDate,
        sale_date: invoice.saleDate,
        due_date: invoice.dueDate,
        invoice_type: invoice.invoiceType,
        currency: invoice.currency,
        seller_name: invoice.seller.name,
        seller_address: invoice.seller.address,
        seller_nip: invoice.seller.nip,
        purchaser_name: invoice.purchaser.name,
        purchaser_address: invoice.purchaser.address,
        payment_method: invoice.payment.method,
        payment_account_number: invoice.payment.accountNumber,
        net_total: invoice.totals.netTotal,
        tax_total: invoice.totals.taxTotal,
        gross_total: invoice.totals.grossTotal,
      });

    if (invoiceError) throw invoiceError;

    // Delete existing line items if updating
    if (existingId) {
      await supabase
        .from('invoiceparser_line_items')
        .delete()
        .eq('invoice_id', id);
    }

    // Insert line items
    if (invoice.lineItems.length > 0) {
      const { error: lineItemsError } = await supabase
        .from('invoiceparser_line_items')
        .insert(
          invoice.lineItems.map(item => ({
            invoice_id: id,
            item_no: item.no,
            description: item.description,
            net_price: item.netPrice,
            quantity: item.quantity,
            unit: item.unit,
            net_value: item.netValue,
            tax: item.tax,
            gross_value: item.grossValue,
          }))
        );

      if (lineItemsError) throw lineItemsError;
    }

    return {
      id,
      filename,
      parsedAt,
      invoice,
    };
  } catch (err) {
    console.error('Failed to add invoice:', err);
    throw err;
  }
}

// Delete an invoice from Supabase
export async function deleteInvoice(id: string): Promise<void> {
  try {
    // Line items will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('invoiceparser_invoices')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    console.error('Failed to delete invoice:', err);
    throw err;
  }
}

// Clear all invoices from Supabase
export async function clearAllInvoices(): Promise<void> {
  try {
    const { error } = await supabase
      .from('invoiceparser_invoices')
      .delete()
      .neq('id', ''); // Delete all rows

    if (error) throw error;
  } catch (err) {
    console.error('Failed to clear all invoices:', err);
    throw err;
  }
}

// Export to JSON (unchanged)
export function exportToJson(invoices: StoredInvoice[]): string {
  return JSON.stringify(invoices, null, 2);
}

// Import from JSON (unchanged)
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
export async function loadManualValues(): Promise<Record<string, number>> {
  try {
    const { data, error } = await supabase
      .from('invoiceparser_manual_values')
      .select('*');

    if (error) throw error;
    if (!data) return {};

    const values: Record<string, number> = {};
    data.forEach(row => {
      values[row.month_key] = parseFloat(row.value);
    });

    return values;
  } catch (err) {
    console.error('Failed to load manual values:', err);
    return {};
  }
}

// Save manual values (not typically used directly)
export async function saveManualValues(values: Record<string, number>): Promise<void> {
  try {
    // Clear existing values
    await supabase
      .from('invoiceparser_manual_values')
      .delete()
      .neq('month_key', '');

    // Insert new values
    const entries = Object.entries(values).map(([month_key, value]) => ({
      month_key,
      value,
    }));

    if (entries.length > 0) {
      const { error } = await supabase
        .from('invoiceparser_manual_values')
        .insert(entries);

      if (error) throw error;
    }
  } catch (err) {
    console.error('Failed to save manual values:', err);
    throw err;
  }
}

// Set a single manual value
export async function setManualValue(month: string, value: number): Promise<void> {
  try {
    const { error } = await supabase
      .from('invoiceparser_manual_values')
      .upsert({
        month_key: month,
        value,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;
  } catch (err) {
    console.error('Failed to set manual value:', err);
    throw err;
  }
}

// Get a single manual value
export async function getManualValue(month: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('invoiceparser_manual_values')
      .select('value')
      .eq('month_key', month)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return 0; // Not found
      throw error;
    }

    return data ? parseFloat(data.value) : 0;
  } catch (err) {
    console.error('Failed to get manual value:', err);
    return 0;
  }
}
