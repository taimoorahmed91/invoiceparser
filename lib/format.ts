/**
 * Single source for money / number / date / delta formatting (plan §5.4).
 * Display only: stored values (DD/MM/YYYY dates, "Mon YYYY" month keys) never change.
 * Flip LOCALE_NUM to 'en-US' to go back to US-style numbers (open question 1).
 */
import { monthNames } from './dates';

export const LOCALE_NUM = 'pl-PL';

const NBSP = '\u00a0';
const MINUS = '\u2212'; // real minus sign, not hyphen

/** Normalise separators so output is identical across ICU versions. */
function tidy(s: string): string {
  return s.replace(/\u202f/g, NBSP).replace(/^-/, MINUS);
}

const moneyCache = new Map<string, Intl.NumberFormat>();
function moneyFormat(currency: string, signed: boolean): Intl.NumberFormat {
  const key = `${currency}|${signed}`;
  let f = moneyCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_NUM, {
      style: 'currency',
      currency,
      // 'always' forces "1 234,50 zł": Polish default groups only from 5 digits, which misaligns columns.
      useGrouping: 'always',
      ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
    });
    moneyCache.set(key, f);
  }
  return f;
}

/** 1234.5 → "1 234,50 zł" (NBSP before zł); -80 → "−80,00 zł". */
export function fmtMoney(value: number, currency = 'PLN'): string {
  return tidy(moneyFormat(currency, false).format(value));
}

const wholeCache = new Map<string, Intl.NumberFormat>();
/** Whole units only (KPI cards): 140899.27 → "140 899 zł". */
export function fmtMoneyWhole(value: number, currency = 'PLN'): string {
  let f = wholeCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat(LOCALE_NUM, {
      style: 'currency',
      currency,
      useGrouping: 'always',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    wholeCache.set(currency, f);
  }
  return tidy(f.format(value));
}

/** Same, with an explicit sign for changes: +123,40 zł / −80,00 zł / 0,00 zł. */
export function fmtSignedMoney(value: number, currency = 'PLN'): string {
  return tidy(moneyFormat(currency, true).format(value));
}

export interface MoneyParts {
  sign: '' | typeof MINUS;
  /** "12 840" */
  whole: string;
  /** ",50" (with the decimal separator) */
  fraction: string;
  /** "zł" */
  unit: string;
}

/** For KPI cards: whole złoty large, ",50 zł" small and muted. */
export function fmtMoneyParts(value: number, currency = 'PLN'): MoneyParts {
  const parts = moneyFormat(currency, false).formatToParts(value);
  let sign: '' | typeof MINUS = '';
  let whole = '';
  let fraction = '';
  let unit = '';
  for (const p of parts) {
    if (p.type === 'minusSign') sign = MINUS;
    else if (p.type === 'integer' || p.type === 'group') whole += p.value;
    else if (p.type === 'decimal' || p.type === 'fraction') fraction += p.value;
    else if (p.type === 'currency') unit = p.value;
  }
  return { sign, whole: whole.replace(/\u202f/g, NBSP), fraction, unit };
}

/** Plain number, up to `maxFractionDigits` decimals (default 3): 1.82 → "1,82". */
export function fmtNumber(value: number, maxFractionDigits = 3, minFractionDigits = 0): string {
  return tidy(
    new Intl.NumberFormat(LOCALE_NUM, {
      useGrouping: 'always',
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    }).format(value),
  );
}

/** Quantity with unit after it: (1.82, "GJ") → "1,82 GJ". */
export function fmtQuantity(value: number, unit?: string): string {
  const n = fmtNumber(value, 3);
  return unit ? `${n}${NBSP}${unit}` : n;
}

/** 4.2 → "4,2 %" (one decimal, space before %). Pass a percentage, not a ratio. */
export function fmtPercent(value: number, signed = false): string {
  const n = tidy(
    new Intl.NumberFormat(LOCALE_NUM, {
      useGrouping: 'always',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
    }).format(value),
  );
  return `${n}${NBSP}%`;
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface Delta {
  direction: DeltaDirection;
  arrow: '▲' | '▼' | '';
  /** "+123,40 zł", "−80,00 zł" or "—" when unchanged */
  amount: string;
  /** "+4,2 %" or null when the previous value is 0 (no meaningful percentage) */
  percent: string | null;
  /** "▲ +123,40 zł · +4,2 %" — the sign and arrow are always in the text */
  text: string;
}

/** Change from `previous` to `current`. Costs: up is "bad" (colour is chosen by the caller). */
export function fmtDelta(current: number, previous: number, currency = 'PLN'): Delta {
  const diff = Math.round((current - previous) * 100) / 100;
  if (diff === 0) {
    return { direction: 'flat', arrow: '', amount: '—', percent: null, text: '—' };
  }
  const direction: DeltaDirection = diff > 0 ? 'up' : 'down';
  const arrow = direction === 'up' ? '▲' : '▼';
  const amount = fmtSignedMoney(diff, currency);
  const percent = previous === 0 ? null : fmtPercent((diff / Math.abs(previous)) * 100, true);
  const text = `${arrow} ${amount}${percent ? ` · ${percent}` : ''}`;
  return { direction, arrow, amount, percent, text };
}

/**
 * Delta for any unit: "▲ +0,12 GJ · +4,2 %". `fmt` formats the absolute size (quantity, unit price …); the sign and arrow are added here.
 * Same rules as fmtDelta: nothing below 0,005 counts as a change, no percentage when the previous value is 0.
 */
export function fmtDeltaWith(current: number, previous: number, fmt: (n: number) => string): Delta {
  const diff = Math.round((current - previous) * 100) / 100;
  if (diff === 0) return { direction: 'flat', arrow: '', amount: '—', percent: null, text: '—' };
  const direction: DeltaDirection = diff > 0 ? 'up' : 'down';
  const arrow = direction === 'up' ? '▲' : '▼';
  const amount = `${diff > 0 ? '+' : MINUS}${fmt(Math.abs(diff))}`;
  const percent = previous === 0 ? null : fmtPercent((diff / Math.abs(previous)) * 100, true);
  return { direction, arrow, amount, percent, text: `${arrow} ${amount}${percent ? ` · ${percent}` : ''}` };
}

/** "18/11/2026" → "18 Nov 2026". Unparseable input is returned unchanged ("—" if empty). */
export function fmtDate(ddmmyyyy: string | null | undefined): string {
  if (!ddmmyyyy) return '—';
  const parts = ddmmyyyy.split('/');
  if (parts.length < 3) return ddmmyyyy;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || month < 0 || month > 11 || isNaN(year)) return ddmmyyyy;
  return `${day} ${monthNames[month]} ${year}`;
}

/** Chart tick: "Nov 2026" → "Nov ’26". */
export function fmtMonthTick(monthKey: string): string {
  const m = /^([A-Za-z]{3}) (\d{4})$/.exec(monthKey);
  return m ? `${m[1]} \u2019${m[2].slice(2)}` : monthKey;
}

/**
 * Compact money for chart axes: 800 → "800", 1200 → "1,2 tys.", 5000 → "5 tys.", 2 500 000 → "2,5 mln".
 * Hand-rolled instead of Intl `notation: 'compact'` so every browser prints the same (risk R9).
 */
export function fmtCompactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? MINUS : '';
  if (abs < 1000) return `${sign}${fmtNumber(abs, 0)}`;
  if (abs < 1_000_000) return `${sign}${fmtNumber(abs / 1000, 1)}${NBSP}tys.`;
  return `${sign}${fmtNumber(abs / 1_000_000, 1)}${NBSP}mln`;
}

/** Local time of day, 24 hour: 14:02 (Data → Sync: "last loaded 14:02"). */
export function fmtClock(when: number | Date): string {
  const d = typeof when === 'number' ? new Date(when) : when;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
