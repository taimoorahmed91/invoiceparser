import { describe, expect, it } from 'vitest';
import type { StoredInvoice } from '../lib/storage';
import invoicesJson from './fixtures/invoices.json';
import { combinedInvoice, invoice, line, utilityInvoice } from './fixtures/synthetic';
import { applyFilters, type Filters } from '../lib/filters';
import { kpiLink, invoiceLink } from '../lib/overviewLinks';
import {
  DEFAULT_FILTERS, DEFAULT_SORT, FILTERS_KEY, activeChips, ariaSortOf, describeFilters, detectPreset, invoiceKinds, invoiceListSpec, isTextEntry, nextSort,
  normalizeFilters, parseListFilters, periodLabel, presetRange, resultStats, sameFilters, selectionHint, serializeListFilters, sortList, toggleSelected, typeCounts,
} from '../lib/invoiceList';
import { cellText } from '../lib/dataView';
import { fmtMoney } from '../lib/format';

const real = invoicesJson as StoredInvoice[];
const inv = (num: string, date: string, gross = 100, type: StoredInvoice['invoice']['invoiceType'] = 'Rent'): StoredInvoice => ({ ...invoice([line('x', gross)], type, date), id: `id_${num}`, invoice: { ...invoice([line('x', gross)], type, date).invoice, invoiceNumber: num } });
const stored = (f: Partial<Filters>) => JSON.stringify({ ...DEFAULT_FILTERS, ...f });

describe('reading the filters: URL wins, then the saved ones', () => {
  it('nothing in the URL and nothing saved → defaults', () => expect(parseListFilters('', null)).toEqual(DEFAULT_FILTERS));

  it('saved filters keep the exact legacy shape and are restored', () => {
    const f = parseListFilters('', stored({ filterType: 'Utility', searchQuery: 'FA/MYS', dateRangeStart: '2025-01', dateRangeEnd: '2025-11' }));
    expect(f).toEqual({ filterType: 'Utility', filterMonth: 'all', searchQuery: 'FA/MYS', dateRangeStart: '2025-01', dateRangeEnd: '2025-11' });
  });

  it('a URL with any filter wins over the saved ones completely (no mixing)', () => {
    const f = parseListFilters('?type=Rent&from=2026-01', stored({ filterType: 'Utility', searchQuery: 'old', dateRangeEnd: '2025-06' }));
    expect(f).toEqual({ ...DEFAULT_FILTERS, filterType: 'Rent', dateRangeStart: '2026-01' });
  });

  it('works with and without the leading ?, and decodes the invoice number from an Overview row link', () => {
    expect(parseListFilters('q=FA%2FMYS%2F124%2F11%2F2026', null).searchQuery).toBe('FA/MYS/124/11/2026');
    expect(parseListFilters('?q=abc', null).searchQuery).toBe('abc');
  });

  it('a URL with unrelated params only (?foo=1) falls back to the saved filters', () => {
    expect(parseListFilters('?foo=1&invoice=abc', stored({ filterType: 'Parking' })).filterType).toBe('Parking');
  });

  it('the links Overview and the KPI cards produce are understood (month, type, from/to, q)', () => {
    const search = (href: string) => href.slice(href.indexOf('?'));
    expect(parseListFilters(search(kpiLink('total', '2026-11').href), null)).toEqual({ ...DEFAULT_FILTERS, dateRangeStart: '2026-11', dateRangeEnd: '2026-11' });
    expect(parseListFilters(search(kpiLink('utility', '2026-11').href), null)).toEqual({ ...DEFAULT_FILTERS, filterType: 'Utility', dateRangeStart: '2026-11', dateRangeEnd: '2026-11' });
    expect(parseListFilters(search(kpiLink('ytd', '2026-11').href), null)).toEqual({ ...DEFAULT_FILTERS, dateRangeStart: '2026-01', dateRangeEnd: '2026-11' });
    // an invoice deep link carries no filter: the saved filters stay as they are
    expect(parseListFilters(search(invoiceLink(combinedInvoice).href), JSON.stringify({ ...DEFAULT_FILTERS, filterType: 'Rent' }))).toEqual({ ...DEFAULT_FILTERS, filterType: 'Rent' });
  });

  it('junk is ignored, never thrown: bad type, bad months, broken JSON, wrong shapes', () => {
    expect(parseListFilters('?type=Banana&from=2026-13&to=nope', null)).toEqual(DEFAULT_FILTERS);
    expect(parseListFilters('', '{broken')).toEqual(DEFAULT_FILTERS);
    expect(parseListFilters('', '[1,2]')).toEqual(DEFAULT_FILTERS);
    expect(parseListFilters('', JSON.stringify({ filterType: 5, searchQuery: 9, dateRangeStart: 'x' }))).toEqual(DEFAULT_FILTERS);
  });

  it('the storage key is unchanged', () => expect(FILTERS_KEY).toBe('invoice-parser-filters'));
});

describe('legacy month → Period (F21/F22)', () => {
  it('a saved month becomes From = To and the month filter is switched off, so nothing hides behind the Period control', () => {
    const f = parseListFilters('', stored({ filterMonth: 'Nov 2026' }));
    expect(f).toEqual({ ...DEFAULT_FILTERS, dateRangeStart: '2026-11', dateRangeEnd: '2026-11' });
    expect(activeChips(f).map((c) => c.key)).toEqual(['period']);
  });
  it('the converted filter selects exactly the same invoices as the legacy month filter', () => {
    for (const month of ['Jan 2025', 'Jun 2025', 'Jan 2026']) {
      const legacy = applyFilters(real, { ...DEFAULT_FILTERS, filterMonth: month });
      const now = applyFilters(real, parseListFilters('', stored({ filterMonth: month })));
      expect(now).toEqual(legacy);
    }
  });
  it('"Unknown" (invoices with no readable date) cannot become a range: it stays, and shows as its own chip', () => {
    const f = parseListFilters('', stored({ filterMonth: 'Unknown' }));
    expect(f.filterMonth).toBe('Unknown');
    expect(activeChips(f).map((c) => c.label)).toEqual(['Month: Unknown']);
  });
  it('a start after the end is swapped', () => {
    expect(normalizeFilters({ ...DEFAULT_FILTERS, dateRangeStart: '2026-05', dateRangeEnd: '2025-01' })).toMatchObject({ dateRangeStart: '2025-01', dateRangeEnd: '2026-05' });
  });
});

describe('writing them back', () => {
  it('only what is set goes in the query string; defaults are left out', () => {
    expect(serializeListFilters(DEFAULT_FILTERS)).toBe('');
    expect(serializeListFilters({ ...DEFAULT_FILTERS, filterType: 'Utility', searchQuery: 'FA/MYS', dateRangeStart: '2025-01', dateRangeEnd: '2025-11' })).toBe('q=FA%2FMYS&type=Utility&from=2025-01&to=2025-11');
  });
  it('round trip: parse(serialize(f)) = f for every combination', () => {
    for (const filterType of ['all', 'Rent', 'Utility'] as const) for (const searchQuery of ['', 'a b', 'FA/MYS/1#&=']) for (const [s, e] of [['', ''], ['2025-01', ''], ['', '2026-02'], ['2025-03', '2025-03']]) {
      const f = { ...DEFAULT_FILTERS, filterType, searchQuery, dateRangeStart: s, dateRangeEnd: e };
      expect(parseListFilters(serializeListFilters(f), null)).toEqual(f);
    }
  });
  it('sameFilters compares all five fields', () => {
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS })).toBe(true);
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, searchQuery: 'x' })).toBe(false);
  });
});

describe('Period presets', () => {
  const months = ['2025-01', '2025-06', '2026-01', '2026-11'];
  const now = new Date(2026, 10, 3);
  it('labels', () => {
    expect(periodLabel('', '')).toBeNull();
    expect(periodLabel('2025-01', '2025-11')).toBe('Jan 2025 – Nov 2025');
    expect(periodLabel('2026-11', '2026-11')).toBe('Nov 2026');
    expect(periodLabel('2025-01', '')).toBe('From Jan 2025');
    expect(periodLabel('', '2025-11')).toBe('Until Nov 2025');
  });
  it('all time, this year, last 12 months (ends at the newest month with data)', () => {
    expect(presetRange('all', months, now)).toEqual({ from: '', to: '' });
    expect(presetRange('year', months, now)).toEqual({ from: '2026-01', to: '2026-12' });
    expect(presetRange('last12', months, now)).toEqual({ from: '2025-12', to: '2026-11' });
    expect(presetRange('last12', [], now)).toEqual({ from: '2025-12', to: '2026-11' });
  });
  it('a range is recognised as its preset, otherwise it is custom', () => {
    expect(detectPreset('', '', months, now)).toBe('all');
    expect(detectPreset('2026-01', '2026-12', months, now)).toBe('year');
    expect(detectPreset('2025-12', '2026-11', months, now)).toBe('last12');
    expect(detectPreset('2025-01', '2025-11', months, now)).toBe('custom');
    expect(detectPreset('2026-11', '2026-11', months, now)).toBe('custom');
  });
});

describe('chips, counts, result strip', () => {
  it('every active filter is a chip that knows how to remove itself', () => {
    const f: Filters = { ...DEFAULT_FILTERS, filterType: 'Utility', searchQuery: 'x', dateRangeStart: '2025-01', dateRangeEnd: '2025-11' };
    const chips = activeChips(f);
    expect(chips.map((c) => [c.key, c.label])).toEqual([['search', 'Search: “x”'], ['type', 'Utility'], ['period', 'Jan 2025 – Nov 2025']]);
    let cur = f;
    for (const c of chips) cur = { ...cur, ...c.clear };
    expect(cur).toEqual(DEFAULT_FILTERS);
    expect(activeChips(DEFAULT_FILTERS)).toEqual([]);
  });
  it('type counts are what each chip would show with the search and period applied', () => {
    const c = typeCounts(real, DEFAULT_FILTERS);
    expect(c.all).toBe(real.length);
    expect(c.Rent + c.Parking + c.Utility + c.Other).toBe(c.all);
    expect(c.Utility).toBe(real.filter((r) => r.invoice.invoiceType === 'Utility').length);
    const inRange = typeCounts(real, { ...DEFAULT_FILTERS, dateRangeStart: '2026-01', dateRangeEnd: '2026-01' });
    expect(inRange.all).toBe(applyFilters(real, { ...DEFAULT_FILTERS, dateRangeStart: '2026-01', dateRangeEnd: '2026-01' }).length);
    // choosing a type chip never changes the other counts
    expect(typeCounts(real, { ...DEFAULT_FILTERS, filterType: 'Rent' })).toEqual(c);
  });
  it('result strip: count and the sum of gross totals', () => {
    expect(resultStats([inv('A', '01/01/2026', 100.1), inv('B', '01/02/2026', 200.2)])).toEqual({ count: 2, total: 300.3 });
    expect(resultStats([])).toEqual({ count: 0, total: 0 });
    expect(resultStats(real).total).toBeCloseTo(real.reduce((s, r) => s + r.invoice.totals.grossTotal, 0), 2);
  });
  it('describeFilters for the report header', () => {
    expect(describeFilters(DEFAULT_FILTERS)).toBe('none');
    expect(describeFilters({ ...DEFAULT_FILTERS, filterType: 'Utility', dateRangeStart: '2025-01', dateRangeEnd: '2025-11' })).toBe('Type: Utility · Period: Jan 2025 – Nov 2025');
  });
});

describe('sorting: Issued ↓ by default', () => {
  const rows = [inv('FA/MYS/289/01/2026', '08/01/2026', 50), inv('FA/MYS/124/11/2026', '02/11/2026', 300, 'Utility'), inv('FA/MYS/130/10/2026', '01/10/2026', 100, 'Parking'), inv('NODATE', '', 10)];
  it('default is newest first, unreadable dates last', () => {
    expect(DEFAULT_SORT).toEqual({ field: 'date', dir: 'desc' });
    expect(sortList(rows, DEFAULT_SORT).map((r) => r.invoice.invoiceNumber)).toEqual(['FA/MYS/124/11/2026', 'FA/MYS/130/10/2026', 'FA/MYS/289/01/2026', 'NODATE']);
    expect(sortList(rows, { field: 'date', dir: 'asc' }).map((r) => r.invoice.invoiceNumber)).toEqual(['FA/MYS/289/01/2026', 'FA/MYS/130/10/2026', 'FA/MYS/124/11/2026', 'NODATE']);
  });
  it('amount, type and invoice number (numbers compared as numbers) both ways; input untouched', () => {
    const copy = [...rows];
    expect(sortList(rows, { field: 'amount', dir: 'desc' }).map((r) => r.invoice.totals.grossTotal)).toEqual([300, 100, 50, 10]);
    expect(sortList(rows, { field: 'type', dir: 'asc' }).map((r) => r.invoice.invoiceType)).toEqual(['Parking', 'Rent', 'Rent', 'Utility']);
    expect(sortList(rows, { field: 'number', dir: 'asc' }).map((r) => r.invoice.invoiceNumber)).toEqual(['FA/MYS/124/11/2026', 'FA/MYS/130/10/2026', 'FA/MYS/289/01/2026', 'NODATE']);
    expect(rows).toEqual(copy);
  });
  it('equal values keep their original order (stable)', () => {
    const same = [inv('B', '01/01/2026', 10), inv('A', '01/01/2026', 10), inv('C', '01/01/2026', 10)];
    expect(sortList(same, { field: 'amount', dir: 'asc' }).map((r) => r.invoice.invoiceNumber)).toEqual(['B', 'A', 'C']);
    expect(sortList(same, { field: 'amount', dir: 'desc' }).map((r) => r.invoice.invoiceNumber)).toEqual(['B', 'A', 'C']);
  });
  it('clicking a header: same column flips; a new column starts newest/biggest first or A→Z; aria-sort follows', () => {
    expect(nextSort(DEFAULT_SORT, 'date')).toEqual({ field: 'date', dir: 'asc' });
    expect(nextSort(DEFAULT_SORT, 'amount')).toEqual({ field: 'amount', dir: 'desc' });
    expect(nextSort(DEFAULT_SORT, 'number')).toEqual({ field: 'number', dir: 'asc' });
    expect(nextSort({ field: 'type', dir: 'asc' }, 'type')).toEqual({ field: 'type', dir: 'desc' });
    expect(ariaSortOf(DEFAULT_SORT, 'date')).toBe('descending');
    expect(ariaSortOf({ field: 'date', dir: 'asc' }, 'date')).toBe('ascending');
    expect(ariaSortOf(DEFAULT_SORT, 'amount')).toBe('none');
  });
});

describe('rows, selection, keyboard scoping', () => {
  it('the combined invoice is Rent + Parking everywhere in the list', () => {
    expect(invoiceKinds(combinedInvoice)).toEqual(['Rent', 'Parking']);
    expect(invoiceKinds(utilityInvoice)).toEqual(['Utility']);
    expect(invoiceKinds(inv('X', '01/01/2026', 5, 'Other'))).toEqual(['Other']);
  });
  it('selection holds at most two; a third is refused; unselecting frees a slot; order is the order picked', () => {
    let s: string[] = [];
    s = toggleSelected(s, 'a'); s = toggleSelected(s, 'b');
    expect(s).toEqual(['a', 'b']);
    expect(toggleSelected(s, 'c')).toEqual(['a', 'b']);
    expect(toggleSelected(s, 'a')).toEqual(['b']);
    expect(toggleSelected(['b'], 'c')).toEqual(['b', 'c']);
  });
  it('selection hints', () => {
    expect(selectionHint(0)).toBe('');
    expect(selectionHint(1)).toBe('1 selected — pick one more to compare');
    expect(selectionHint(2)).toBe('2 selected');
  });
  it('Cmd/Ctrl+Z and "/" leave text fields alone but not checkboxes or buttons', () => {
    expect(isTextEntry({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(isTextEntry({ tagName: 'INPUT', type: 'search' })).toBe(true);
    expect(isTextEntry({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntry({ tagName: 'SELECT' })).toBe(true);
    expect(isTextEntry({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEntry({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(isTextEntry({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextEntry({ tagName: 'TR' })).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

describe('the table behind the list (export, PDF, CSV)', () => {
  it('Invoice · File · Issued · Type · Total, one row per invoice, month AND year in Issued', () => {
    const t = invoiceListSpec([combinedInvoice, utilityInvoice]);
    expect(t.columns.map((c) => c.label)).toEqual(['Invoice', 'File', 'Issued', 'Type', 'Total']);
    const text = t.rows.map((r) => t.columns.map((c) => cellText(c, r)));
    expect(text[0]).toEqual([combinedInvoice.invoice.invoiceNumber, combinedInvoice.filename, '3 Nov 2026', 'Rent + Parking', fmtMoney(2600)]);
    expect(text[1][3]).toBe('Utility');
  });
  it('empty list → no rows', () => expect(invoiceListSpec([]).rows).toEqual([]));
});
