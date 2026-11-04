import { describe, expect, it } from 'vitest';
import { linkGross, linkNet, linkTax, parseAmount, textsFor, validateEdit } from '../lib/invoiceEdit';
import { fmtMoney } from '../lib/format';

/** The old page's handlers, verbatim in spirit (page.tsx before Phase 8). */
const legacyNet = (v: string, tax: string) => ((parseFloat(v) || 0) + (parseFloat(tax) || 0)).toFixed(2);
const legacyGross = (v: string, net: string) => Math.max(0, (parseFloat(v) || 0) - (parseFloat(net) || 0)).toFixed(2);
const legacyOk = (gross: string, net: string, tax: string) => {
  const g = parseFloat(gross), n = parseFloat(net), t = parseFloat(tax);
  if (isNaN(g) || isNaN(n) || isNaN(t)) return false;
  return !(Math.abs(g - (n + t)) > 0.01);
};

describe('edit form linkage equals the old form', () => {
  const nets = ['', '0', '1', '4700', '1234.5', '99.99'];
  const taxes = ['', '0', '23', '1080.5', '0.01'];
  it('Net or VAT edited → Total = Net + VAT, to the cent', () => {
    for (const n of nets) for (const t of taxes) {
      const texts = { net: '100.00', tax: t, gross: '0.00' };
      expect(linkNet(texts, n).gross).toBe(legacyNet(n, t));
      expect(linkTax({ net: n, tax: '0', gross: '0.00' }, t).gross).toBe(legacyNet(n, t));
    }
  });
  it('Total edited → VAT = max(0, Total − Net)', () => {
    for (const g of ['', '0', '50', '123.45', '5150']) for (const n of nets) {
      expect(linkGross({ net: n, tax: '0.00', gross: '0.00' }, g).tax).toBe(legacyGross(g, n));
    }
  });
  it('save is allowed or refused exactly like before (0.01 tolerance, numbers only)', () => {
    const cases: Array<[string, string, string]> = [['100.00', '77.00', '23.00'], ['100.01', '77.00', '23.00'], ['100.02', '77.00', '23.00'], ['abc', '1', '2'], ['100', '', '0'], ['99.99', '77', '23']];
    for (const [g, n, t] of cases) expect(validateEdit({ gross: g, net: n, tax: t }).ok).toBe(legacyOk(g, n, t));
  });
});

describe('what the form says', () => {
  it('a mismatch names the difference; a non-number gets its own message', () => {
    const bad = validateEdit({ net: '100', tax: '23', gross: '120.97' });
    expect(bad).toEqual({ ok: false, error: `Total must equal Net + VAT (difference ${fmtMoney(2.03)}).` });
    expect(validateEdit({ net: 'x', tax: '1', gross: '1' })).toEqual({ ok: false, error: 'Enter a number for Net, VAT and Total.' });
  });
  it('a valid form returns the numbers', () => {
    expect(validateEdit({ net: '100.00', tax: '23.00', gross: '123.00' })).toEqual({ ok: true, net: 100, tax: 23, gross: 123 });
  });
  it('commas are decimals now', () => {
    expect(parseAmount('1,5')).toBe(1.5);
    expect(parseAmount(' 12.30 ')).toBe(12.3);
    expect(parseAmount('-4')).toBe(-4);
    for (const bad of ['', 'a', '1,2,3', '1e3', '--1', '1 000']) expect(parseAmount(bad)).toBeNull();
  });
  it('starting texts are the stored totals to the cent', () => {
    expect(textsFor({ netTotal: 4700, taxTotal: 0, grossTotal: 4700 })).toEqual({ net: '4700.00', tax: '0.00', gross: '4700.00' });
  });
});
