'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { SidebarNav } from './SidebarNav';
import { SkipLink } from './SkipLink';
import { TopBar } from './TopBar';

/**
 * App shell (plan §3.3 / §4.1): skip link, sidebar or rail, top bar, content, phone tab bar.
 * Landmarks: <aside> > <nav aria-label="Main"> (or the bottom <nav aria-label="Main">, only one is displayed),
 * <header>, <main id="content">.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  return (
    <>
      <SkipLink />
      <div className="app-shell">
        <SidebarNav pathname={pathname} />
        <div className="min-w-0 flex flex-col">
          <TopBar pathname={pathname} />
          <main id="content" tabIndex={-1} className="shell-main">
            {children}
          </main>
        </div>
      </div>
      <BottomNav pathname={pathname} />
    </>
  );
}
