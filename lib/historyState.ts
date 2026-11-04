/**
 * Browser history helpers for the Invoices page.
 *
 * Next's app router patches history.pushState / replaceState so that `useSearchParams()` follows URL changes made with them, but only when
 * the state object passed in is NOT its own (it skips anything carrying `__NA`, to avoid loops). So never pass `window.history.state` back in:
 * pass only your own marks, Next copies its internal state into the new entry itself.
 */

/** Set on the history entry that opening the drawer added, so closing can go "back" instead of piling up entries. */
export const DRAWER_MARK = 'invoiceDrawer';

/** Our own marks of the current entry, without Next's internals. */
function ownMarks(): Record<string, unknown> | null {
  return window.history.state?.[DRAWER_MARK] ? { [DRAWER_MARK]: true } : null;
}

/** Replace the URL of the current entry (keeps our marks; `useSearchParams()` follows). */
export function replaceUrl(url: string): void {
  window.history.replaceState(ownMarks(), '', url);
}

/** Add an entry for the open drawer. */
export function pushDrawerUrl(url: string): void {
  window.history.pushState({ [DRAWER_MARK]: true }, '', url);
}

export const drawerEntryIsOurs = (): boolean => Boolean(window.history.state?.[DRAWER_MARK]);
