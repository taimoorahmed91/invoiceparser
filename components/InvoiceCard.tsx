'use client';

import { ParsedInvoice } from '@/lib/parseInvoice';
import LineItemTable from './LineItemTable';

interface InvoiceCardProps {
  filename: string;
  invoice: ParsedInvoice;
  manualValue?: number;
}

export default function InvoiceCard({ filename, invoice, manualValue = 0 }: InvoiceCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white font-bold text-lg">
              Invoice {invoice.invoiceNumber}
            </h3>
            <p className="text-orange-100 text-sm mt-1">{filename}</p>
          </div>
          <div className="text-right">
            <div className="text-white text-2xl font-bold">
              {formatCurrency(invoice.totals.grossTotal)} {invoice.currency}
            </div>
            <p className="text-orange-100 text-xs mt-1">Total Amount</p>
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Issue Date</p>
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{invoice.issueDate || '-'}</p>
      </div>

      {/* Line Items */}
      <div className="px-6 py-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Line Items</h4>
        <LineItemTable items={invoice.lineItems} currency={invoice.currency} manualValue={manualValue} />
      </div>

      {/* Totals */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700">
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Net Total:</span>
              <span className="font-medium dark:text-gray-100">{formatCurrency(invoice.totals.netTotal)} {invoice.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax:</span>
              <span className="font-medium dark:text-gray-100">{formatCurrency(invoice.totals.taxTotal)} {invoice.currency}</span>
            </div>
            {manualValue > 0 && (
              <>
                <div className="flex justify-between text-sm text-blue-600 dark:text-blue-400">
                  <span>Manual Heating Added ({manualValue} × 76):</span>
                  <span className="font-medium">+{formatCurrency(manualValue * 76)}</span>
                </div>
                <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                  <span>Central Heating Adjusted:</span>
                  <span className="font-medium">-{formatCurrency(manualValue * 76)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-base pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold text-gray-800 dark:text-gray-100">Gross Total:</span>
              <span className="font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(invoice.totals.grossTotal)} {invoice.currency}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
