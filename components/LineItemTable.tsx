'use client';

import { LineItem } from '@/lib/parseInvoice';

interface LineItemTableProps {
  items: LineItem[];
  currency: string;
  manualValue?: number;
}

export default function LineItemTable({ items, currency, manualValue = 0 }: LineItemTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
        No line items found in this invoice
      </div>
    );
  }

  // Find Central Heating item and calculate adjusted values
  const manualAdjustment = manualValue * 76;
  const centralHeatingIndex = items.findIndex(item => 
    item.description.toLowerCase() === 'central heating' || 
    item.description.toLowerCase().includes('central heating') ||
    item.description.toLowerCase().includes('ciepła')
  );

  // Check if manual heating calculation row already exists (from saved data)
  const hasManualHeatingRow = items.some(item => 
    item.description.toLowerCase().includes('manual heating calculation')
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900 text-left">
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">#</th>
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400">Description</th>
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Qty</th>
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Unit Price</th>
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Net Value</th>
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Tax</th>
            <th className="px-3 py-2 font-medium text-gray-600 dark:text-gray-400 text-right">Gross</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((item, idx) => {
            // Adjust Central Heating values if manual value exists and row doesn't already exist in saved data
            const isCentralHeating = idx === centralHeatingIndex && manualValue > 0 && !hasManualHeatingRow;
            const adjustedGrossValue = isCentralHeating 
              ? Math.max(0, item.grossValue - manualAdjustment)
              : item.grossValue;
            const adjustedNetValue = isCentralHeating
              ? Math.max(0, item.netValue - manualAdjustment)
              : item.netValue;
            const adjustedNetPrice = isCentralHeating && item.quantity > 0
              ? adjustedGrossValue / item.quantity
              : item.netPrice;

            return (
              <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isCentralHeating ? 'bg-red-50 dark:bg-red-900/30' : ''}`}>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{item.no}</td>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-100 max-w-xs truncate" title={item.description}>
                  {item.description}
                  {isCentralHeating && manualValue > 0 && (
                    <span className="text-xs text-red-600 dark:text-red-400 ml-2">(adjusted)</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                  {item.quantity} {item.unit}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                  {formatCurrency(adjustedNetPrice)}
                </td>
                <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                  {formatCurrency(adjustedNetValue)}
                </td>
                <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                  {item.tax}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${isCentralHeating ? 'text-red-700 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                  {formatCurrency(adjustedGrossValue)} {currency}
                </td>
              </tr>
            );
          })}
          {manualValue > 0 && !hasManualHeatingRow && (
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 bg-blue-50 dark:bg-blue-900/30">
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{items.length + 1}</td>
              <td className="px-3 py-2 text-gray-800 dark:text-gray-100 font-medium">
                Manual Heating Calculation ({manualValue} × 76)
              </td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                1 UNIT
              </td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                {formatCurrency(manualValue * 76)}
              </td>
              <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400">
                {formatCurrency(manualValue * 76)}
              </td>
              <td className="px-3 py-2 text-right text-gray-500 dark:text-gray-400">
                0%
              </td>
              <td className="px-3 py-2 text-right font-medium text-blue-700 dark:text-blue-400">
                {formatCurrency(manualValue * 76)} {currency}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
