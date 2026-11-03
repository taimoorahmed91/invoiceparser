'use client';

import { useState } from 'react';
import { BarChart3, Download, FileText, FileUp, Info, X, Pencil, Printer, Table2, Trash2, CircleCheck, CircleAlert, TriangleAlert } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Tabs } from '@/components/ui/Tabs';
import { ToggleChip, RemovableChip } from '@/components/ui/ToggleChip';
import { MenuButton, MenuItems, type MenuEntry } from '@/components/ui/MenuButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Search } from '@/components/ui/Search';
import { Checkbox } from '@/components/ui/Checkbox';
import { Tooltip } from '@/components/ui/Tooltip';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/toast/ToastProvider';

const h4 = 'text-[13px] font-medium text-ink-muted mb-2';

export function SegmentedDemo() {
  const [view, setView] = useState('chart');
  const [type, setType] = useState('bar');
  const [range, setRange] = useState('12m');
  const [metric, setMetric] = useState('cost');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <p className={h4}>sm · 2 items</p>
          <SegmentedControl
            size="sm"
            aria-label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart', icon: BarChart3 },
              { value: 'table', label: 'Table', icon: Table2 },
            ]}
          />
        </div>
        <div>
          <p className={h4}>sm · Line disabled (reason shows under it)</p>
          <SegmentedControl
            size="sm"
            aria-label="Chart type"
            value={type}
            onChange={setType}
            options={[
              { value: 'bar', label: 'Bar' },
              { value: 'line', label: 'Line', disabledReason: 'Line needs at least 4 months with data — you have 3.' },
              { value: 'area', label: 'Area', disabledReason: 'Area needs at least 4 months with data — you have 3.' },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <p className={h4}>md · 4 items</p>
          <SegmentedControl
            aria-label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: '6m', label: '6M' },
              { value: '12m', label: '12M' },
              { value: 'all', label: 'All' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>
        <div>
          <p className={h4}>md · hover forced on "Usage"</p>
          <SegmentedControl
            aria-label="Metric"
            value={metric}
            onChange={setMetric}
            forceHoverValue="usage"
            options={[
              { value: 'cost', label: 'Cost' },
              { value: 'usage', label: 'Usage' },
              { value: 'price', label: 'Unit price' },
            ]}
          />
        </div>
      </div>
      <div className="max-w-sm">
        <p className={h4}>Full width (phones), 2 items</p>
        <SegmentedControl
          fullWidth
          aria-label="View on phones"
          value={view}
          onChange={setView}
          options={[
            { value: 'chart', label: 'Chart' },
            { value: 'table', label: 'Table' },
          ]}
        />
      </div>
      <div className="sr-only-text" aria-hidden="true">
        <span data-contrast="Segmented · track border" data-contrast-kind="border" className="seg" />
        <span data-contrast="Segmented · selected ring (ink on track)" data-contrast-kind="custom" data-contrast-fg="--ink" data-contrast-bg="--surface-2" />
      </div>
    </div>
  );
}

export function TabsChipsDemo() {
  const [tab, setTab] = useState('monthly');
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(true);
  const [filters, setFilters] = useState(['Utility', 'Jan 2025 – Nov 2025']);
  return (
    <div className="space-y-5">
      <div>
        <p className={h4}>Tabs (hover forced on "Year over year")</p>
        <Tabs
          idBase="gallery"
          aria-label="Analytics sections"
          value={tab}
          onChange={setTab}
          forceHoverId="yoy"
          tabs={[
            { id: 'monthly', label: 'Monthly costs' },
            { id: 'utilities', label: 'Utilities' },
            { id: 'yoy', label: 'Year over year' },
          ]}
        />
      </div>
      <div>
        <p className={h4}>Toggle chips: off · on · with count · type chip with dot · disabled</p>
        <div className="flex flex-wrap gap-2">
          <ToggleChip label="Rent" pressed={a} onPressedChange={setA} />
          <ToggleChip label="Parking" pressed={b} onPressedChange={setB} dotColor="var(--parking)" count={4} />
          <ToggleChip label="Utility" pressed={c} onPressedChange={setC} dotColor="var(--utility)" count={9} />
          <ToggleChip label="Other" pressed={false} onPressedChange={() => {}} dotColor="var(--other)" count={1} disabledReason="No invoices of this type" />
        </div>
      </div>
      <div>
        <p className={h4}>Removable chips (active filters)</p>
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <RemovableChip key={f} label={f} onRemove={() => setFilters((p) => p.filter((x) => x !== f))} />
          ))}
          {filters.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setFilters([])}>
              Clear all
            </Button>
          )}
          {filters.length === 0 && <span className="text-[13px] text-ink-subtle">No active filters</span>}
        </div>
      </div>
      <div
        data-contrast="Chip · pressed border (ink on surface-3)"
        data-contrast-kind="custom"
        data-contrast-fg="--ink"
        data-contrast-bg="--surface-3"
        className="sr-only-text"
      >
        probe
      </div>
    </div>
  );
}

export function MenuDemo() {
  const noop = () => {};
  const entries: MenuEntry[] = [
    { type: 'group', label: 'Download' },
    { label: 'JSON (all invoices)', icon: FileText, onSelect: noop },
    { label: 'CSV (current list)', icon: FileText, description: 'Heating adjustments are included', onSelect: noop },
    { label: 'Excel-compatible (.xls)', icon: FileText, onSelect: noop },
    { label: 'PDF (current list)', icon: FileText, disabledReason: 'Nothing to export yet', onSelect: noop },
    { type: 'separator' },
    { label: 'Print list…', icon: Printer, shortcut: '⌘P', onSelect: noop },
  ];
  const rowEntries: MenuEntry[] = [
    { label: 'Open', onSelect: noop },
    { label: 'Edit', icon: Pencil, onSelect: noop },
    { type: 'separator' },
    { label: 'Delete', icon: Trash2, destructive: true, onSelect: noop },
  ];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3">
        <MenuButton label="Export" icon={Download} entries={entries} />
        <MenuButton label="Import" icon={FileUp} variant="ghost" size="sm" entries={entries} />
        <MenuButton trigger="icon" label="Actions for FA/MYS/124/11/2026" entries={rowEntries} align="end" />
      </div>
      <div>
        <p className={h4}>Open menu (static preview of the panel: groups, description, disabled with reason, shortcut, destructive last)</p>
        <div className="flex flex-wrap gap-4 items-start">
          <div className="menu-panel" role="presentation" style={{ position: 'static' }} data-contrast="Menu item text" data-contrast-kind="text">
            <MenuItems entries={entries} onSelectEntry={() => {}} />
          </div>
          <div className="menu-panel" role="presentation" style={{ position: 'static', minWidth: 180 }}>
            <MenuItems entries={rowEntries} onSelectEntry={() => {}} />
            <div className="sr-only-text" aria-hidden="true">
              <div data-contrast="Menu destructive text" data-contrast-kind="text" className="menu-item" data-destructive="true">
                Delete
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InputsDemo() {
  const [q, setQ] = useState('FA/MYS');
  const [q2, setQ2] = useState('');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Invoice number" placeholder="FA/MYS/124/11/2026" data-contrast="Input text" />
      <Input label="Hover (forced)" placeholder="Hover state" forceState="hover" />
      <Input label="Focus (forced)" defaultValue="Typing here" forceState="focus" />
      <Input label="Total" numeric suffix="zł" defaultValue="5150,00" helper="Total must equal Net + VAT." />
      <Input label="Net" defaultValue="12" error="Enter a number, for example 1234,50" />
      <Input label="Locked field" defaultValue="Read only for now" disabledReason="Edit mode is off" />
      <Select label="Type" defaultValue="Utility">
        <option>Rent</option>
        <option>Parking</option>
        <option>Utility</option>
        <option>Other</option>
      </Select>
      <Select label="Error select" error="Choose a type" defaultValue="">
        <option value="" disabled>Choose…</option>
        <option>Rent</option>
      </Select>
      <div>
        <p className={h4}>Search (with text → Clear button; Esc clears)</p>
        <Search aria-label="Search invoices" value={q} onChange={setQ} placeholder="Search number or file…" />
      </div>
      <div>
        <p className={h4}>Search, empty</p>
        <Search aria-label="Search invoices (empty)" value={q2} onChange={setQ2} placeholder="Search number or file…" />
      </div>
      <div className="flex items-center gap-4 sm:col-span-2">
        <div className="sr-only-text" aria-hidden="true">
          <div className="ctl" data-contrast="Input border" data-contrast-kind="border" />
          <div data-contrast="Input placeholder (ink-subtle on surface)" data-contrast-kind="custom" data-contrast-fg="--ink-subtle" data-contrast-bg="--surface" />
        </div>
      </div>
    </div>
  );
}

export function CheckboxDemo() {
  const [on, setOn] = useState(true);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Checkbox label="Unchecked" />
        <Checkbox label="Checked" checked={on} onChange={(e) => setOn(e.target.checked)} />
        <Checkbox label="Indeterminate" indeterminate />
        <Checkbox label="Focus (forced)" data-box-state="focus" />
        <Checkbox label="Disabled with reason" disabledReason="Compare works with two invoices" />
        <Checkbox aria-label="Select FA/MYS/124/11/2026" cell />
      </div>
      <span
        data-contrast="Checkbox border"
        data-contrast-kind="border"
        className="cb-box"
        aria-hidden="true"
      />
    </div>
  );
}

export function TooltipToastDemo() {
  const toast = useToast();
  return (
    <div className="space-y-5">
      <div>
        <p className={h4}>Tooltip (hover or Tab to the icon; Esc closes) — and a static preview</p>
        <div className="flex items-center gap-4">
          <Tooltip content="Full screen">
            <IconButton label="Full screen" icon={Info} variant="secondary" />
          </Tooltip>
          <span className="tooltip-panel" style={{ position: 'static', display: 'inline-block' }} role="presentation" data-contrast="Tooltip text" data-contrast-kind="text">
            Line needs at least 4 months with data
          </span>
        </div>
      </div>
      <div>
        <p className={h4}>Toasts (static previews)</p>
        <div className="grid gap-2 max-w-md">
          {[
            { t: 'success', Icon: CircleCheck, m: 'Successfully added 2 invoice(s)' },
            { t: 'error', Icon: CircleAlert, m: 'Failed to save some invoices to database' },
            { t: 'warning', Icon: TriangleAlert, m: 'You can only compare 2 invoices at a time' },
            { t: 'info', Icon: Info, m: 'No new invoices added — all were duplicates' },
          ].map(({ t, Icon, m }) => (
            <div key={t} className={`toast toast-${t}`} style={{ animation: 'none' }} data-contrast={`Toast ${t} text`} data-contrast-kind="text">
              <Icon className="toast-icon" size={20} strokeWidth={1.75} aria-hidden="true" />
              <div className="toast-body">{m}</div>
              <div className="toast-actions">
                {t === 'warning' && <Button variant="ghost" size="sm">Undo</Button>}
                <IconButton label="Dismiss notification" icon={X} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className={h4}>Live toasts (bottom right): errors stay, Undo lasts 8 s, others 4–6 s; hover pauses</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast.success('Invoice updated successfully')}>Success</Button>
          <Button size="sm" onClick={() => toast.info('No new invoices added — all were duplicates')}>Info</Button>
          <Button size="sm" onClick={() => toast.warning('You can only compare 2 invoices at a time')}>Warning</Button>
          <Button size="sm" onClick={() => toast.error('Failed to delete invoice')}>Error (stays)</Button>
          <Button size="sm" onClick={() => toast.success('Deleted FA/MYS/124/11/2026', { action: { label: 'Undo', onClick: () => toast.info('Invoice restored') } })}>
            With Undo
          </Button>
        </div>
      </div>
    </div>
  );
}
