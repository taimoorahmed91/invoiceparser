'use client';

import { Dialog } from '@/components/overlay/Dialog';
import { Button } from '@/components/ui/Button';
import { getMonthYearFromDate } from '@/lib/dates';
import type { LineItem } from '@/lib/parseInvoice';
import type { StoredInvoice } from '@/lib/storage';

/**
 * TEMPORARY (Phase 8). The old comparison view, moved unchanged into a dialog so nothing is lost before Phase 9b replaces it with the
 * real Compare dialog (A/B header, Swap, "Only in A/B" chips, DataPanels). Only its Close button is the new control.
 */
export function LegacyCompareDialog({ a, b, onClose, returnFocusTo }: { a: StoredInvoice; b: StoredInvoice; onClose: () => void; returnFocusTo: HTMLElement | null }) {
  const comparingInvoices: [StoredInvoice | null, StoredInvoice | null] = [a, b];
  return (
    <Dialog wide closeButton title="Invoice comparison" returnFocusTo={returnFocusTo} onClose={onClose} actions={<Button variant="secondary" data-autofocus onClick={onClose}>Close</Button>}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700">
              <div className="p-4 border-r border-gray-200 dark:border-gray-700 min-w-0 [overflow-wrap:anywhere]">
                <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {comparingInvoices[0]?.invoice.invoiceNumber}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {comparingInvoices[0] && getMonthYearFromDate(comparingInvoices[0].invoice.issueDate)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {comparingInvoices[0]?.filename}
                </div>
              </div>
              <div className="p-4 min-w-0 [overflow-wrap:anywhere]">
                <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {comparingInvoices[1]?.invoice.invoiceNumber}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {comparingInvoices[1] && getMonthYearFromDate(comparingInvoices[1].invoice.issueDate)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {comparingInvoices[1]?.filename}
                </div>
              </div>
            </div>

            {/* Totals Comparison */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Totals</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['netTotal', 'taxTotal', 'grossTotal'] as const).map((totalType) => {
                  if (!comparingInvoices[0] || !comparingInvoices[1]) return null;
                  const value1 = comparingInvoices[0].invoice.totals[totalType];
                  const value2 = comparingInvoices[1].invoice.totals[totalType];
                  const diff = value2 - value1;
                  const diffPercent = value1 !== 0 ? ((diff / value1) * 100).toFixed(1) : '0.0';
                  const isIncrease = diff > 0;
                  const isDecrease = diff < 0;

                  return (
                    <div key={totalType} className="space-y-1">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        {totalType === 'netTotal' ? 'Net Total' : totalType === 'taxTotal' ? 'Tax' : 'Gross Total'}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {comparingInvoices[0] && new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: comparingInvoices[0].invoice.currency,
                            minimumFractionDigits: 2,
                          }).format(value1)}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {comparingInvoices[1] && new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: comparingInvoices[1].invoice.currency,
                            minimumFractionDigits: 2,
                          }).format(value2)}
                        </div>
                      </div>
                      {diff !== 0 && (
                        <div className={`text-xs font-medium flex items-center gap-1 ${
                          isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                        }`}>
                          <span>{isIncrease ? '▲' : '▼'}</span>
                          <span>
                            {isIncrease ? '+' : ''}
                            {new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: comparingInvoices[0].invoice.currency,
                              minimumFractionDigits: 2,
                            }).format(Math.abs(diff))}
                          </span>
                          <span>({isIncrease ? '+' : ''}{diffPercent}%)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Line Items Comparison */}
            <div className="p-4">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Line Items</h4>
              <div className="space-y-2">
                {(() => {
                  if (!comparingInvoices[0] || !comparingInvoices[1]) return null;
                  // Match line items by description
                  const items1 = comparingInvoices[0].invoice.lineItems;
                  const items2 = comparingInvoices[1].invoice.lineItems;
                  const matchedItems: Array<{
                    item1: LineItem | null;
                    item2: LineItem | null;
                    description: string;
                  }> = [];

                  // Create a map of items by normalized description
                  const normalizeDesc = (desc: string) => desc.toLowerCase().trim();
                  const map1 = new Map(items1.map(item => [normalizeDesc(item.description), item]));
                  const map2 = new Map(items2.map(item => [normalizeDesc(item.description), item]));

                  // Get all unique descriptions
                  const allDescriptions = new Set([
                    ...items1.map(item => normalizeDesc(item.description)),
                    ...items2.map(item => normalizeDesc(item.description)),
                  ]);

                  allDescriptions.forEach(desc => {
                    matchedItems.push({
                      item1: map1.get(desc) || null,
                      item2: map2.get(desc) || null,
                      description: map1.get(desc)?.description || map2.get(desc)?.description || desc,
                    });
                  });

                  return matchedItems.map((match, idx) => {
                    const { item1, item2, description } = match;
                    const hasItem1 = item1 !== null;
                    const hasItem2 = item2 !== null;
                    const isMissing = !hasItem1 || !hasItem2;

                    if (hasItem1 && hasItem2) {
                      const grossDiff = item2.grossValue - item1.grossValue;
                      const unitPriceDiff = item2.netPrice - item1.netPrice;
                      const quantityDiff = item2.quantity - item1.quantity;
                      const quantityPercent = item1.quantity !== 0 ? ((quantityDiff / item1.quantity) * 100).toFixed(1) : '0.0';

                      return (
                        <div key={idx} className="grid grid-cols-2 gap-4 p-3 [&>*]:min-w-0 [overflow-wrap:anywhere] bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              <div>Gross: {comparingInvoices[0] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[0].invoice.currency, minimumFractionDigits: 2 }).format(item1.grossValue)}</div>
                              <div>Unit Price: {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item1.netPrice)} {item1.unit}</div>
                              <div>Quantity: {item1.quantity}</div>
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                              <div className="flex items-center gap-2">
                                <span>Gross: {comparingInvoices[1] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[1].invoice.currency, minimumFractionDigits: 2 }).format(item2.grossValue)}</span>
                                {grossDiff !== 0 && comparingInvoices[1] && (
                                  <span className={`text-xs font-medium ${grossDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    ({grossDiff > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[1].invoice.currency, minimumFractionDigits: 2 }).format(grossDiff)})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span>Unit Price: {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item2.netPrice)} {item2.unit}</span>
                                {unitPriceDiff !== 0 && (
                                  <span className={`text-xs font-medium ${unitPriceDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    ({unitPriceDiff > 0 ? '+' : ''}{unitPriceDiff.toFixed(2)})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span>Quantity: {item2.quantity}</span>
                                {quantityDiff !== 0 && (
                                  <span className={`text-xs font-medium ${quantityDiff > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    ({quantityDiff > 0 ? '+' : ''}{quantityDiff} ({quantityDiff > 0 ? '+' : ''}{quantityPercent}%))
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div key={idx} className="grid grid-cols-2 gap-4 p-3 [&>*]:min-w-0 [overflow-wrap:anywhere] bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                          <div>
                            {hasItem1 && item1 ? (
                              <>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {comparingInvoices[0] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[0].invoice.currency, minimumFractionDigits: 2 }).format(item1.grossValue)}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-400 dark:text-gray-500 italic">Not in this invoice</div>
                            )}
                          </div>
                          <div>
                            {hasItem2 && item2 ? (
                              <>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{description}</div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  {comparingInvoices[1] && new Intl.NumberFormat('en-US', { style: 'currency', currency: comparingInvoices[1].invoice.currency, minimumFractionDigits: 2 }).format(item2.grossValue)}
                                </div>
                              </>
                            ) : (
                              <div className="text-sm text-gray-400 dark:text-gray-500 italic">Not in this invoice</div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </div>
          </div>
    </Dialog>
  );
}
