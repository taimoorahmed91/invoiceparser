'use client';

import type { ReactNode } from 'react';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { ButtonMatrix, IconAndLabelDemo } from './GalleryButtons';
import { SegmentedDemo, TabsChipsDemo, MenuDemo, InputsDemo, CheckboxDemo, TooltipToastDemo } from './GalleryControls';
import { LayoutSamples } from './GalleryLayouts';
import { PressDemo, RollingDemo } from './GalleryMotion';
import { ContrastTable } from './ContrastTable';
import { fmtMoney, fmtDelta, fmtMoneyParts, fmtDate, fmtCompactMoney } from '@/lib/format';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-[17px] leading-6 font-semibold mb-3 pb-2 border-b border-border">{title}</h3>
      {children}
    </section>
  );
}

/** A panel that forces one theme regardless of the page theme (the variables live on .light / .dark). */
function ThemePanel({ theme, children, label }: { theme: 'light' | 'dark'; children: ReactNode; label: string }) {
  return (
    <div
      data-theme-panel={`${theme} · ${label}`}
      className={`${theme} bg-canvas text-ink rounded-xl border border-border p-4 sm:p-6 min-w-0`}
    >
      <h2 className="text-[20px] leading-7 font-semibold mb-5 capitalize">{theme} theme</h2>
      {children}
    </div>
  );
}

function TypeCheck() {
  const rows = [1234.5, 61480.1, 111.11, 8888.88, -80, 0];
  const parts = fmtMoneyParts(12840.5);
  const delta = fmtDelta(1262.3, 1158.1);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <p className="text-[13px] font-medium text-ink-muted mb-2">Money (pl-PL) in a tabular column</p>
        <table className="text-[14px]">
          <tbody>
            {rows.map((v) => (
              <tr key={v}><td className="pr-6 text-right">{fmtMoney(v)}</td><td className="text-ink-subtle text-[12px]">{fmtDate('18/11/2026')}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[32px] leading-9 font-semibold tnum">
          {parts.whole}<span className="text-[16px] text-ink-muted font-normal">{parts.fraction}{'\u00a0'}{parts.unit}</span>
        </p>
        <p className="text-[13px] mt-1 text-increase">{delta.text}</p>
        <p className="text-[12px] text-ink-subtle mt-1">Axis ticks: {[800, 1200, 5000, 2500000].map(fmtCompactMoney).join(' · ')}</p>
      </div>
      <div>
        <p className="text-[13px] font-medium text-ink-muted mb-2">Polish glyphs in Fira Sans, identifiers in Fira Code</p>
        <p lang="pl" className="text-[17px]">Centralne ogrzewanie · Zimna woda · Gospodarka odpadami</p>
        <p lang="pl" className="text-[17px] mt-1">łżśćąęóń ŁŻŚĆĄĘÓŃ</p>
        <p className="font-mono text-[14px] mt-3">FA/MYS/124/11/2026 · PL12 1020 3453 0000 0000 0000 0000</p>
        <p className="text-[14px] mt-3 tnum">Digits: 1111111111 / 0000000000 / 8888888888</p>
      </div>
    </div>
  );
}

function ControlsBody() {
  return (
    <>
      <Section title="Type, numbers, Polish glyphs"><TypeCheck /></Section>
      <Section title="Press feedback — press me"><PressDemo /></Section>
      <Section title="Rolling numbers"><RollingDemo /></Section>
      <Section title="Buttons — variant × size × state"><ButtonMatrix /></Section>
      <Section title="Icons, loading, icon-only, link"><IconAndLabelDemo /></Section>
      <Section title="Segmented control"><SegmentedDemo /></Section>
      <Section title="Tabs and chips"><TabsChipsDemo /></Section>
      <Section title="Menu button"><MenuDemo /></Section>
      <Section title="Inputs, select, search"><InputsDemo /></Section>
      <Section title="Checkbox"><CheckboxDemo /></Section>
      <Section title="Tooltip and toasts"><TooltipToastDemo /></Section>
    </>
  );
}

export function Gallery() {
  return (
    <div className="min-h-screen bg-canvas text-ink p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-8 font-semibold">UI gallery</h1>
          <p className="text-ink-muted text-[14px] max-w-prose">
            Every control from plan §2.7 in light and dark. Development only — this route is a 404 in production builds.
            Hover, pressed and focus are forced so they can be reviewed without interacting.
          </p>
        </div>
        <ThemeSwitch size="md" />
      </header>

      <div className="grid gap-6 xl:grid-cols-2 grid-cols-[minmax(0,1fr)]">
        <ThemePanel theme="light" label="controls"><ControlsBody /></ThemePanel>
        <ThemePanel theme="dark" label="controls"><ControlsBody /></ThemePanel>
      </div>

      <h2 className="text-[20px] leading-7 font-semibold mt-12 mb-4">Layouts: desktop and 375 px frames</h2>
      <div className="grid gap-6 grid-cols-[minmax(0,1fr)]">
        <ThemePanel theme="light" label="layouts"><LayoutSamples /></ThemePanel>
        <ThemePanel theme="dark" label="layouts"><LayoutSamples /></ThemePanel>
      </div>

      <ContrastTable />
    </div>
  );
}
