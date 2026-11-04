'use client';

import { NavItem } from './NavItem';
import { NAV_ITEMS, activeEntry } from './nav';

/** Phone tab bar (< 768 px): 4 items, 56 px + safe area, label always visible. */
export function BottomNav({ pathname }: { pathname: string }) {
  const active = activeEntry(pathname);
  return (
    <nav aria-label="Main" className="bottom-nav no-print">
      {NAV_ITEMS.map((entry) => (
        <NavItem key={entry.href} entry={entry} variant="bottom" active={active?.href === entry.href} />
      ))}
    </nav>
  );
}
