'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import { NavItem } from './NavItem';
import { ThemeMenu } from './ThemeMenu';
import { NAV_ITEMS, activeEntry } from './nav';

/**
 * Sidebar (≥ 1280 px), collapsible to the icon rail; the rail is also what shows at 768–1279 px.
 * CSS decides which one is visible (see app/shell.css); this component only needs to know when to
 * turn on rail tooltips, because the labels are not visible then.
 */
export function SidebarNav({ pathname }: { pathname: string }) {
  const { prefs, update } = useUiPrefs();
  const wide = useMediaQuery('(min-width: 1280px)');
  const railMode = !wide || prefs.sidebarCollapsed;
  const active = activeEntry(pathname);

  return (
    <aside className="shell-side" aria-label="Sidebar">
      <Link href="/" className="side-head" aria-label="Invoice Parser, home">
        <span className="side-mark" aria-hidden="true">
          <ReceiptText size={18} strokeWidth={1.75} />
        </span>
        <span className="side-word sf">Invoice Parser</span>
      </Link>

      <nav aria-label="Main" className="side-nav">
        {NAV_ITEMS.map((entry) => (
          <NavItem
            key={entry.href}
            entry={entry}
            variant="side"
            active={active?.href === entry.href}
            tooltip={railMode}
          />
        ))}
      </nav>

      <div className="side-foot">
        <div className="sf">
          <Button variant="ghost" icon={PanelLeftClose} onClick={() => update({ sidebarCollapsed: true })} className="w-full">
            Collapse sidebar
          </Button>
        </div>
        <div className="sr-xl">
          <IconButton label="Expand sidebar" icon={PanelLeftOpen} size="md" onClick={() => update({ sidebarCollapsed: false })} />
        </div>
        <div className="sf">
          <ThemeMenu variant="full" />
        </div>
        <div className="sr">
          <ThemeMenu variant="icon" />
        </div>
      </div>
    </aside>
  );
}
