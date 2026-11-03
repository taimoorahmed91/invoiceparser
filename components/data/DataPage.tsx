'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useInvoices } from '@/hooks/useInvoices';
import { AppearancePanel } from './AppearancePanel';
import { DangerZone } from './DangerZone';
import { ExportPanel } from './ExportPanel';
import { ImportPanel } from './ImportPanel';
import { ShortcutsPanel } from './ShortcutsPanel';
import { SyncPanel } from './SyncPanel';

// The manual values panel can draw a chart, so it carries Recharts: load it after the rest of the page is ready (plan §6.3).
const ManualValuesTable = dynamic(() => import('./ManualValuesTable').then((m) => m.ManualValuesTable), {
  ssr: false,
  loading: () => <Skeleton height={420} label="Loading manual heating values" />,
});

/** The sections, in page order. `id` is the anchor the contents list links to. */
export const DATA_SECTIONS = [
  { id: 'manual', label: 'Manual heating values' },
  { id: 'import-export', label: 'Import & export' },
  { id: 'sync', label: 'Sync' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
  { id: 'danger', label: 'Danger zone' },
] as const;

/**
 * Sticky contents list (≥ 1024 px): jumps to a section and marks the one being read.
 * The section being read is the last one whose top has passed just under the top bar; at the very bottom of the page it is the last section
 * (a short last section can never reach the top, so a plain "in view" test would never select it).
 */
function Contents() {
  const [active, setActive] = useState<string>(DATA_SECTIONS[0].id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = 120;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current: string = DATA_SECTIONS[0].id;
      for (const s of DATA_SECTIONS) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top <= line) current = s.id;
      }
      setActive(atBottom ? DATA_SECTIONS[DATA_SECTIONS.length - 1].id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div className="dt-aside">
      <nav className="dt-toc" aria-label="On this page">
        <p className="dt-toc-title">On this page</p>
        <ul>
          {DATA_SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} onClick={() => setActive(s.id)}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function DataPage() {
  const { status, loadedAt, error, reload } = useInvoices();

  if (status === 'error' && loadedAt === null) {
    return (
      <Banner action={<Button variant="secondary" onClick={() => void reload()}>Retry</Button>}>
        Couldn’t load your invoices from the database. Your data is not lost. {error ? <span className="text-ink-muted">({error})</span> : null}
      </Banner>
    );
  }
  // After the first load, "Reload from database" keeps the page in place instead of flashing skeletons.
  if (status === 'loading' && loadedAt === null) {
    return (
      <div className="dt-layout" aria-busy="true">
        <div className="dt-main">
          <Skeleton height={420} label="Loading manual heating values" />
          <Skeleton height={360} label="Loading import and export" />
          <Skeleton height={160} label="Loading sync" />
        </div>
      </div>
    );
  }

  return (
    <div className="dt-layout">
      <div className="dt-main">
        <div id="manual" className="dt-anchor flex flex-col gap-3">
          <ManualValuesTable />
        </div>
        <section id="import-export" className="dt-card dt-anchor" aria-labelledby="import-export-title">
          <div>
            <h2 className="dt-title" id="import-export-title">Import &amp; export</h2>
            <p className="dt-desc">Move invoices in from a backup, or take a copy out.</p>
          </div>
          <ImportPanel />
          <ExportPanel />
        </section>
        <section id="sync" className="dt-anchor" aria-labelledby="sync-title">
          <SyncPanel />
        </section>
        <section id="appearance" className="dt-anchor" aria-labelledby="appearance-title">
          <AppearancePanel />
        </section>
        <section id="shortcuts" className="dt-anchor" aria-labelledby="shortcuts-title">
          <ShortcutsPanel />
        </section>
        <section id="danger" className="dt-anchor" aria-labelledby="danger-title">
          <DangerZone />
        </section>
      </div>
      <Contents />
    </div>
  );
}
