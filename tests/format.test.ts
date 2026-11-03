import { describe, it, expect } from 'vitest';
import {
  fmtMoney,
  fmtSignedMoney,
  fmtMoneyParts,
  fmtNumber,
  fmtQuantity,
  fmtPercent,
  fmtDelta,
  fmtDate,
  fmtMonthTick,
  fmtCompactMoney,
} from '../lib/format';

const NB = '\u00a0';
const MINUS = '\u2212';

describe('fmtMoney', () => {
  it('formats PLN the Polish way with NBSP before zł', () => {
    expect(fmtMoney(1234.5)).toBe(`1${NB}234,50${NB}zł`);
  });
  it('groups four-digit numbers too (columns line up)', () => {
    expect(fmtMoney(4700)).toBe(`4${NB}700,00${NB}zł`);
    expect(fmtMoney(61480.1)).toBe(`61${NB}480,10${NB}zł`);
  });
  it('uses a real minus sign for negatives', () => {
    expect(fmtMoney(-80)).toBe(`${MINUS}80,00${NB}zł`);
  });
  it('formats zero', () => {
    expect(fmtMoney(0)).toBe(`0,00${NB}zł`);
  });
  it('handles other currencies', () => {
    expect(fmtMoney(10, 'EUR')).toContain('€');
  });
});

describe('fmtSignedMoney', () => {
  it('adds + for positive and − for negative, nothing for zero', () => {
    expect(fmtSignedMoney(123.4)).toBe(`+123,40${NB}zł`);
    expect(fmtSignedMoney(-80)).toBe(`${MINUS}80,00${NB}zł`);
    expect(fmtSignedMoney(0)).toBe(`0,00${NB}zł`);
  });
});

describe('fmtMoneyParts', () => {
  it('splits whole and fraction for KPI cards', () => {
    expect(fmtMoneyParts(12840.5)).toEqual({ sign: '', whole: `12${NB}840`, fraction: ',50', unit: 'zł' });
  });
  it('keeps the minus sign', () => {
    expect(fmtMoneyParts(-5).sign).toBe(MINUS);
  });
});

describe('numbers', () => {
  it('fmtNumber uses comma decimals and up to 3 places', () => {
    expect(fmtNumber(1.82)).toBe('1,82');
    expect(fmtNumber(12.4)).toBe('12,4');
    expect(fmtNumber(1.23456)).toBe('1,235');
  });
  it('fmtQuantity puts the unit after a non-breaking space', () => {
    expect(fmtQuantity(1.82, 'GJ')).toBe(`1,82${NB}GJ`);
    expect(fmtQuantity(3)).toBe('3');
  });
  it('fmtPercent has one decimal and a space before %', () => {
    expect(fmtPercent(4.24)).toBe(`4,2${NB}%`);
    expect(fmtPercent(4.24, true)).toBe(`+4,2${NB}%`);
    expect(fmtPercent(-2.06, true)).toBe(`${MINUS}2,1${NB}%`);
  });
});

describe('fmtDelta', () => {
  it('up: arrow, plus sign, amount and percent', () => {
    const d = fmtDelta(1262.3, 1158.1);
    expect(d.direction).toBe('up');
    expect(d.amount).toBe(`+104,20${NB}zł`);
    expect(d.percent).toBe(`+9,0${NB}%`);
    expect(d.text).toBe(`▲ +104,20${NB}zł · +9,0${NB}%`);
  });
  it('down: arrow and real minus', () => {
    const d = fmtDelta(100, 180);
    expect(d.direction).toBe('down');
    expect(d.text).toBe(`▼ ${MINUS}80,00${NB}zł · ${MINUS}44,4${NB}%`);
  });
  it('flat shows an em dash only', () => {
    expect(fmtDelta(50, 50)).toMatchObject({ direction: 'flat', text: '—', percent: null });
  });
  it('previous = 0 gives the amount without a percentage', () => {
    const d = fmtDelta(120, 0);
    expect(d.percent).toBeNull();
    expect(d.text).toBe(`▲ +120,00${NB}zł`);
  });
  it('ignores float noise below one grosz', () => {
    expect(fmtDelta(0.1 + 0.2, 0.3).direction).toBe('flat');
  });
});

describe('dates', () => {
  it('formats DD/MM/YYYY as "18 Nov 2026" without timezone shift', () => {
    expect(fmtDate('18/11/2026')).toBe('18 Nov 2026');
    expect(fmtDate('01/01/2025')).toBe('1 Jan 2025');
    expect(fmtDate('30/09/2025')).toBe('30 Sep 2025');
  });
  it('degrades gracefully', () => {
    expect(fmtDate('')).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
    expect(fmtDate('garbage')).toBe('garbage');
    expect(fmtDate('18/13/2026')).toBe('18/13/2026');
  });
  it('fmtMonthTick shortens the year', () => {
    expect(fmtMonthTick('Nov 2026')).toBe('Nov \u201926');
    expect(fmtMonthTick('Unknown')).toBe('Unknown');
  });
});

describe('fmtCompactMoney (axis ticks)', () => {
  it('prints thousands as tys.', () => {
    expect(fmtCompactMoney(800)).toBe('800');
    expect(fmtCompactMoney(1200)).toBe(`1,2${NB}tys.`);
    expect(fmtCompactMoney(5000)).toBe(`5${NB}tys.`);
    expect(fmtCompactMoney(2_500_000)).toBe(`2,5${NB}mln`);
    expect(fmtCompactMoney(-5000)).toBe(`${MINUS}5${NB}tys.`);
  });
});
