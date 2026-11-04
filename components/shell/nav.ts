import { ChartColumn, Database, LayoutDashboard, ReceiptText, type LucideIcon } from 'lucide-react';

/**
 * Main navigation (plan §3.1). Order follows frequency of use. All four destinations are live links.
 */
export interface NavEntry {
  href: string;
  label: string;
  /** Top-bar page title (h1). */
  title: string;
  /** Shown instead of `title` on phones, where the top bar also holds More and Upload. */
  shortTitle?: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavEntry[] = [
  { href: '/', label: 'Overview', title: 'Overview', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', title: 'Invoices', icon: ReceiptText },
  { href: '/analytics', label: 'Analytics', title: 'Analytics', icon: ChartColumn },
  { href: '/data', label: 'Data', title: 'Data & settings', shortTitle: 'Data', icon: Database },
];

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

/** The page title for a phone-width top bar (falls back to the full title). */
export function pageShortTitle(pathname: string | null | undefined): string {
  const entry = activeEntry(pathname);
  return entry?.shortTitle ?? entry?.title ?? 'Invoice Parser';
}
