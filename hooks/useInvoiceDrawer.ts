'use client';

import { useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { drawerEntryIsOurs, pushDrawerUrl, replaceUrl } from '@/lib/historyState';
import { DRAWER_PARAM, withDrawerParam } from '@/lib/invoiceDetail';

function urlWith(id: string | null): string {
  const qs = withDrawerParam(window.location.search, id);
  return `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
}

/**
 * The open invoice lives in the URL (`?invoice=<id>`, plan §4.4): a link opens it, Back closes it, a reload keeps it.
 *  - open: adds a history entry (so Back = close)
 *  - swap: Prev / Next replace the entry (stepping through the list does not fill the history)
 *  - close: goes Back when the drawer added the entry, otherwise just removes the parameter
 * Reading goes through Next's search params, so a link followed while already on /invoices (Upload → Review) opens it too.
 */
export function useInvoiceDrawer(): { id: string | null; open: (id: string) => void; swap: (id: string) => void; close: () => void } {
  const params = useSearchParams();
  const id = params.get(DRAWER_PARAM) || null;

  const open = useCallback((next: string) => pushDrawerUrl(urlWith(next)), []);
  const swap = useCallback((next: string) => replaceUrl(urlWith(next)), []);
  const close = useCallback(() => {
    if (drawerEntryIsOurs()) window.history.back();
    else replaceUrl(urlWith(null));
  }, []);

  return { id, open, swap, close };
}
