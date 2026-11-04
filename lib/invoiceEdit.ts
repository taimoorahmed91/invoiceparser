/**
 * The linkage and the check of the invoice edit form (F13), exactly the old rules, pure so they can be tested:
 *   editing Net or VAT → Total = Net + VAT          editing Total → VAT = max(0, Total − Net)
 *   saving is refused when |Total − (Net + VAT)| > 0.01 or an amount is not a number
 * One difference, on purpose: "1,5" is 1,5 (the old number box treated a comma as the end of the number).
 */
import { fmtMoney } from './format';

export interface EditTexts {
  net: string;
  tax: string;
  gross: string;
}

const AMOUNT = /^-?(\d+([.,]\d*)?|[.,]\d+)$/;

/** null when the text is not a number. */
export function parseAmount(text: string): number | null {
  const t = text.trim();
  if (!AMOUNT.test(t)) return null;
  const n = parseFloat(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const num = (text: string) => parseAmount(text) ?? 0; // while typing, an empty or half-typed box counts as 0 (parseFloat(x) || 0 before)

export const textsFor = (totals: { netTotal: number; taxTotal: number; grossTotal: number }): EditTexts => ({
  net: totals.netTotal.toFixed(2),
  tax: totals.taxTotal.toFixed(2),
  gross: totals.grossTotal.toFixed(2),
});

export function linkNet(t: EditTexts, net: string): EditTexts {
  return { net, tax: t.tax, gross: (num(net) + num(t.tax)).toFixed(2) };
}
export function linkTax(t: EditTexts, tax: string): EditTexts {
  return { net: t.net, tax, gross: (num(t.net) + num(tax)).toFixed(2) };
}
export function linkGross(t: EditTexts, gross: string): EditTexts {
  return { net: t.net, tax: Math.max(0, num(gross) - num(t.net)).toFixed(2), gross };
}

export type EditCheck = { ok: true; net: number; tax: number; gross: number } | { ok: false; error: string };

export function validateEdit(t: EditTexts, currency = 'PLN'): EditCheck {
  const net = parseAmount(t.net);
  const tax = parseAmount(t.tax);
  const gross = parseAmount(t.gross);
  if (net === null || tax === null || gross === null) return { ok: false, error: 'Enter a number for Net, VAT and Total.' };
  const diff = Math.abs(gross - (net + tax));
  if (diff > 0.01) return { ok: false, error: `Total must equal Net + VAT (difference ${fmtMoney(Math.round(diff * 100) / 100, currency)}).` };
  return { ok: true, net, tax, gross };
}
