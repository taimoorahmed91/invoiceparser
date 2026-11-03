'use client';

import { useState, type ReactNode } from 'react';
import { BarChart3, Download, Ellipsis, FileText, GitCompare, Maximize2, Printer, SlidersHorizontal, Table2, Upload, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ToggleChip, RemovableChip } from '@/components/ui/ToggleChip';
import { MenuButton, type MenuEntry } from '@/components/ui/MenuButton';
import { Search } from '@/components/ui/Search';

const noop = () => {};
const exportEntries: MenuEntry[] = [
  { label: 'JSON (all invoices)', icon: FileText, onSelect: noop },
  { label: 'CSV (current list)', icon: FileText, onSelect: noop },
  { label: 'Excel-compatible (.xls)', icon: FileText, onSelect: noop },
  { label: 'PDF (current list)', icon: FileText, onSelect: noop },
  { type: 'separator' },
  { label: 'Print list…', icon: Printer, onSelect: noop },
];
const moreEntries: MenuEntry[] = [
  { label: 'Report (PDF)', icon: FileText, onSelect: noop },
  { label: 'Export', icon: Download, onSelect: noop },
];

function Frame({ title, width, children }: { title: string; width: 'mobile' | 'desktop'; children: ReactNode }) {
  return (
    <figure className={width === 'mobile' ? 'w-[375px] max-w-full' : 'w-full min-w-0 max-w-[1440px]'}>
      <figcaption className="text-[12px] text-ink-subtle mb-1">{title}</figcaption>
      {/* desktop frames keep their desktop layout and scroll sideways on a phone-sized viewport */}
      <div className="border border-dashed border-border rounded-lg p-4 bg-surface overflow-x-auto">
        <div className={width === 'desktop' ? 'min-w-[820px]' : undefined}>{children}</div>
      </div>
    </figure>
  );
}

function PageHeaderDesktop() {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="text-[26px] leading-8 font-semibold">
        Invoices <span className="text-ink-muted text-[17px] font-normal">26</span>
      </h3>
      <div className="flex items-center gap-2">
        <Button variant="secondary" icon={FileText}>Report (PDF)</Button>
        <MenuButton label="Export" icon={Download} entries={exportEntries} align="end" />
        <Button variant="primary" icon={Upload}>Upload PDFs</Button>
      </div>
    </div>
  );
}

function PageHeaderMobile() {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[20px] leading-7 font-semibold">Invoices</h3>
      <div className="flex items-center gap-2">
        <MenuButton label="More" icon={Ellipsis} entries={moreEntries} align="end" />
        <Button variant="primary" icon={Upload}>Upload</Button>
      </div>
    </div>
  );
}

function FilterBarDesktop() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('Utility');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Search aria-label="Search invoices" value={q} onChange={setQ} placeholder="Search number or file…" className="w-[280px]" />
        <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-2">
          {[
            ['All', 26, undefined],
            ['Rent', 12, 'var(--rent)'],
            ['Parking', 4, 'var(--parking)'],
            ['Utility', 9, 'var(--utility)'],
            ['Other', 1, 'var(--other)'],
          ].map(([l, n, c]) => (
            <ToggleChip key={l as string} label={l as string} count={n as number} dotColor={c as string | undefined} pressed={type === l} onPressedChange={() => setType(l as string)} />
          ))}
        </div>
        <MenuButton label="Period: Jan 2025 – Nov 2025" icon={Calendar} entries={exportEntries} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RemovableChip label="Utility" onRemove={noop} />
        <RemovableChip label="Jan 2025 – Nov 2025" onRemove={noop} />
        <Button variant="ghost" size="sm">Clear all</Button>
      </div>
      <div className="flex items-center justify-between text-[13px] text-ink-muted">
        <span>Showing 9 of 26 · 11 204,10 zł</span>
        <Button variant="ghost" size="sm">Undo delete</Button>
      </div>
    </div>
  );
}

function FilterBarMobile() {
  const [q, setQ] = useState('');
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Search aria-label="Search invoices on phone" value={q} onChange={setQ} placeholder="Search…" className="flex-1" />
        <Button variant="secondary" icon={SlidersHorizontal}>Filters (2)</Button>
      </div>
      <p className="text-[13px] text-ink-muted">Showing 9 of 26 · 11 204,10 zł</p>
    </div>
  );
}

function ChartToolbarDesktop() {
  const [view, setView] = useState('chart');
  const [type, setType] = useState('bar');
  const [stacked, setStacked] = useState(true);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[17px] leading-6 font-semibold">Central Heating — cost by month</h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={Maximize2}>Full screen</Button>
          <MenuButton
            label="Export"
            size="sm"
            icon={Download}
            align="end"
            entries={[
              { label: 'PNG (image)', onSelect: noop },
              { label: 'CSV (chart data)', onSelect: noop },
              { label: 'PDF (chart page)', onSelect: noop },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <SegmentedControl size="sm" aria-label="View desktop" value={view} onChange={setView} options={[{ value: 'chart', label: 'Chart', icon: BarChart3 }, { value: 'table', label: 'Table', icon: Table2 }]} />
        <SegmentedControl
          size="sm"
          aria-label="Chart type desktop"
          value={type}
          onChange={setType}
          options={[
            { value: 'bar', label: 'Bar' },
            { value: 'line', label: 'Line', disabledReason: 'Line needs at least 4 months with data — you have 3.' },
            { value: 'area', label: 'Area', disabledReason: 'Area needs at least 4 months with data — you have 3.' },
          ]}
        />
        {type === 'bar' && <ToggleChip label="Stacked" pressed={stacked} onPressedChange={setStacked} />}
      </div>
    </div>
  );
}

function ChartToolbarMobile() {
  const [view, setView] = useState('chart');
  const [type, setType] = useState('bar');
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[17px] leading-6 font-semibold">Central Heating</h3>
        <MenuButton
          label="More"
          size="sm"
          icon={Ellipsis}
          align="end"
          entries={[
            { label: 'Full screen', icon: Maximize2, onSelect: noop },
            { type: 'separator' },
            { label: 'Export PNG', onSelect: noop },
            { label: 'Export CSV', onSelect: noop },
            { label: 'Export PDF', onSelect: noop },
          ]}
        />
      </div>
      <SegmentedControl fullWidth size="sm" aria-label="View mobile" value={view} onChange={setView} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />
      <SegmentedControl
        fullWidth
        size="sm"
        aria-label="Chart type mobile"
        value={type}
        onChange={setType}
        options={[
          { value: 'bar', label: 'Bar' },
          { value: 'line', label: 'Line', disabledReason: 'Line needs at least 4 months with data — you have 3.' },
          { value: 'area', label: 'Area', disabledReason: 'Area needs at least 4 months with data — you have 3.' },
        ]}
      />
    </div>
  );
}

function SelectionBar({ mobile }: { mobile?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 ${mobile ? '' : ''}`}>
      <span className="text-[14px]">1 selected</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">Clear</Button>
        <Button variant="secondary" size="sm" icon={GitCompare} disabledReason="Select one more invoice">Compare 2 invoices</Button>
      </div>
    </div>
  );
}

function DialogFooters({ mobile }: { mobile?: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[12px] text-ink-subtle mb-1">Confirm delete (Cancel is focused, destructive named with the count)</p>
        <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
          <Button variant="ghost" autoFocus={false}>Cancel</Button>
          <Button variant="destructive">Delete 26 invoices</Button>
        </div>
      </div>
      <div>
        <p className="text-[12px] text-ink-subtle mb-1">Edit invoice footer (Save needs a reason until valid)</p>
        <div className={mobile ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'}>
          <Button variant="ghost">Cancel</Button>
          <Button variant="primary" disabledReason="Total must equal Net + VAT">Save changes</Button>
        </div>
      </div>
      {mobile && (
        <div>
          <p className="text-[12px] text-ink-subtle mb-1">Three actions stack, primary on top</p>
          <div className="grid gap-2">
            <Button variant="primary" fullWidth>Import 23</Button>
            <Button variant="secondary" fullWidth>Replace the 3 existing too</Button>
            <Button variant="ghost" fullWidth>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function LayoutSamples() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_375px] items-start">
        <div className="space-y-6 min-w-0">
          <Frame title="Page header — desktop (≥ 1024): secondary, menu, primary last" width="desktop"><PageHeaderDesktop /></Frame>
          <Frame title="Filter bar — desktop" width="desktop"><FilterBarDesktop /></Frame>
          <Frame title="Chart toolbar — desktop" width="desktop"><ChartToolbarDesktop /></Frame>
          <Frame title="Selection bar — desktop" width="desktop"><SelectionBar /></Frame>
          <Frame title="Dialog footers — desktop" width="desktop"><DialogFooters /></Frame>
        </div>
        <div className="space-y-6">
          <Frame title="Page header — 375: title + Upload + More" width="mobile"><PageHeaderMobile /></Frame>
          <Frame title="Filter bar — 375: search + Filters (2)" width="mobile"><FilterBarMobile /></Frame>
          <Frame title="Chart toolbar — 375: More menu + full-width switches" width="mobile"><ChartToolbarMobile /></Frame>
          <Frame title="Selection bar — 375" width="mobile"><SelectionBar mobile /></Frame>
          <Frame title="Dialog footers — 375: 50/50, three stacked" width="mobile"><DialogFooters mobile /></Frame>
        </div>
      </div>
    </div>
  );
}
