-- Supabase Database Schema for Invoice Parser
-- Run this script in your Supabase SQL Editor
-- All tables prefixed with 'invoiceparser_' for shared database

-- Create invoices table
CREATE TABLE invoiceparser_invoices (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  parsed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invoice_number TEXT,
  issue_date TEXT,
  sale_date TEXT,
  due_date TEXT,
  invoice_type TEXT CHECK (invoice_type IN ('Rent', 'Parking', 'Utility', 'Other')),
  currency TEXT DEFAULT 'PLN',

  -- Seller info
  seller_name TEXT,
  seller_address TEXT,
  seller_nip TEXT,

  -- Purchaser info
  purchaser_name TEXT,
  purchaser_address TEXT,

  -- Payment info
  payment_method TEXT,
  payment_account_number TEXT,

  -- Totals
  net_total DECIMAL(10,2),
  tax_total DECIMAL(10,2),
  gross_total DECIMAL(10,2),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create line_items table
CREATE TABLE invoiceparser_line_items (
  id SERIAL PRIMARY KEY,
  invoice_id TEXT REFERENCES invoiceparser_invoices(id) ON DELETE CASCADE,
  item_no INTEGER NOT NULL,
  description TEXT NOT NULL,
  net_price DECIMAL(10,2),
  quantity DECIMAL(10,3),
  unit TEXT,
  net_value DECIMAL(10,2),
  tax TEXT,
  gross_value DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create manual_values table (for manual entries)
CREATE TABLE invoiceparser_manual_values (
  id SERIAL PRIMARY KEY,
  month_key TEXT UNIQUE NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_invoiceparser_invoices_invoice_type ON invoiceparser_invoices(invoice_type);
CREATE INDEX idx_invoiceparser_invoices_issue_date ON invoiceparser_invoices(issue_date);
CREATE INDEX idx_invoiceparser_invoices_invoice_number ON invoiceparser_invoices(invoice_number);
CREATE INDEX idx_invoiceparser_line_items_invoice_id ON invoiceparser_line_items(invoice_id);
CREATE INDEX idx_invoiceparser_manual_values_month_key ON invoiceparser_manual_values(month_key);

-- Enable Row Level Security (RLS)
ALTER TABLE invoiceparser_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceparser_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoiceparser_manual_values ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - you can restrict later)
CREATE POLICY "Allow all operations on invoices" ON invoiceparser_invoices FOR ALL USING (true);
CREATE POLICY "Allow all operations on line_items" ON invoiceparser_line_items FOR ALL USING (true);
CREATE POLICY "Allow all operations on manual_values" ON invoiceparser_manual_values FOR ALL USING (true);
