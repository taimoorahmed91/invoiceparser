'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Filters } from '@/lib/filters';
import { replaceUrl } from '@/lib/historyState';
import { DRAWER_PARAM, readDrawerId } from '@/lib/invoiceDetail';
import { DEFAULT_FILTERS, FILTERS_KEY, parseListFilters, sameFilters, serializeListFilters } from '@/lib/invoiceList';

function readInitial(): Filters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(FILTERS_KEY);
  } catch {
    /* private mode: no saved filters */
  }
  return parseListFilters(window.location.search, saved);
}

/**
 * The Invoices filters (plan §4.3): URL first, then the saved ones, same localStorage key and shape as always, mirrored back to the URL.
 *
 * The starting value is read in the initial state, before the first render of the list. The old page loaded them in one effect and saved
 * the defaults in another effect of the same mount, which under React StrictMode (dev) overwrote the saved filters with the defaults before
 * they were read again. Here nothing is written until the user changes something (or the URL brought new filters).
 */
export function useInvoiceFilters(): {
  filters: Filters;
  set: (patch: Partial<Filters>) => void;
  clear: () => void;
} {
  const [filters, setFilters] = useState<Filters>(readInitial);

  useEffect(() => {
    // `filters` already IS what was saved (or what the URL said), so this only writes when something differs
    // (a change by the user, filters that came from a link, or a legacy month converted to a range).
    try {
      const json = JSON.stringify(filters);
      if (window.localStorage.getItem(FILTERS_KEY) !== json) window.localStorage.setItem(FILTERS_KEY, json);
    } catch {
      /* private mode */
    }
    // the filters own their keys; anything else in the query (the open invoice, ?invoice=) stays as it is
    const open = readDrawerId(window.location.search);
    const params = new URLSearchParams(serializeListFilters(filters));
    if (open) params.set(DRAWER_PARAM, open);
    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) replaceUrl(next);
  }, [filters]);

  const set = useCallback((patch: Partial<Filters>) => setFilters((f) => {
    const next = { ...f, ...patch };
    return sameFilters(f, next) ? f : next;
  }), []);
  const clear = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  return { filters, set, clear };
}
