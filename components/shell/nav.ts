import { ChartColumn, Database, LayoutDashboard, ReceiptText, type LucideIcon } from 'lucide-react';

/**
 * Main navigation (plan §3.1). Order follows frequency of use.
 * ENABLED_ROUTES grows as phases ship: a route that is not in it is shown but unavailable ("Soon").
 * Phase 2: only the old page, moved to /invoices. Phase 4a adds /analytics. Phase 5 adds Overview (`/`). Data arrives in Phase 6.
 */
export interface NavEntry {
  href: string;
  label: string;
  /** Top-bar page title (h1). */
  title: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavEntry[] = [
  { href: '/', label: 'Overview', title: 'Overview', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', title: 'Invoices', icon: ReceiptText },
  { href: '/analytics', label: 'Analytics', title: 'Analytics', icon: ChartColumn },
  { href: '/data', label: 'Data', title: 'Data & settings', icon: Database },
];

export const ENABLED_ROUTES: readonly string[] = ['/', '/invoices', '/analytics'];

export function isEnabled(href: string, enabled: readonly string[] = ENABLED_ROUTES): boolean {
  return enabled.includes(href);
}

/** The nav entry a pathname belongs to ("/invoices?invoice=1" and "/invoices/x" → Invoices). "/" only matches exactly. */
export function activeEntry(pathname: string | null | undefined, items: readonly NavEntry[] = NAV_ITEMS): NavEntry | null {
  if (!pathname) return null;
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  let best: NavEntry | null = null;
  for (const item of items) {
    const match = item.href === '/' ? clean === '/' : clean === item.href || clean.startsWith(item.href + '/');
    if (match && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

export function pageTitle(pathname: string | null | undefined): string {
  return activeEntry(pathname)?.title ?? 'Invoice Parser';
}

/** Reason shown for a nav item that is not built yet. */
export function unavailableReason(entry: NavEntry): string {
  return `${entry.label} is coming in a later update`;
}
