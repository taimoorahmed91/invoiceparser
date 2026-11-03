'use client';

import { useState } from 'react';
import { ArrowRight, Download, GitCompare, Pencil, Trash2, Upload, X, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import type { ControlSize } from '@/components/ui/cx';

const VARIANTS: Array<{ v: Exclude<ButtonVariant, 'link'>; label: string }> = [
  { v: 'primary', label: 'Upload PDFs' },
  { v: 'secondary', label: 'Export' },
  { v: 'ghost', label: 'Cancel' },
  { v: 'destructive', label: 'Delete 26 invoices' },
  { v: 'destructive-quiet', label: 'Delete all invoices…' },
];
const SIZES: ControlSize[] = ['sm', 'md', 'lg'];
const STATES = ['default', 'hover', 'active', 'focus-visible', 'disabled', 'loading'] as const;

function StateButton({
  variant,
  size,
  state,
  label,
  contrast,
}: {
  variant: Exclude<ButtonVariant, 'link'>;
  size: ControlSize;
  state: (typeof STATES)[number];
  label: string;
  contrast?: boolean;
}) {
  const tag = contrast ? { 'data-contrast': `${variant} · ${state}` } : {};
  const common = { variant, size, ...tag };
  switch (state) {
    case 'hover':
      return <Button {...common} data-state="hover">{label}</Button>;
    case 'active':
      return <Button {...common} data-state="active">{label}</Button>;
    case 'focus-visible':
      return <Button {...common} data-state="focus">{label}</Button>;
    case 'disabled':
      return <Button {...common} disabledReason="Select one more invoice">{label}</Button>;
    case 'loading':
      return <LoadingDemo {...common}>{label}</LoadingDemo>;
    default:
      return <Button {...common}>{label}</Button>;
  }
}

/** Shows the loading look straight away (spinner delay skipped by mounting with loading=true then waiting). */
function LoadingDemo(props: { variant: Exclude<ButtonVariant, 'link'>; size: ControlSize; children: string }) {
  return <Button {...props} loading>{props.children}</Button>;
}

export function ButtonMatrix() {
  return (
    <div className="space-y-8">
      {SIZES.map((size) => (
        <div key={size}>
          <h4 className="text-[13px] font-medium text-ink-muted mb-3">Size {size}</h4>
          <div className="space-y-4">
            {VARIANTS.map(({ v, label }) => (
              <div key={v}>
                <p className="text-[12px] text-ink-subtle mb-1.5">{v}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-3">
                  {STATES.map((s) => (
                    <div key={s} className="flex flex-col items-start gap-1">
                      <StateButton variant={v} size={size} state={s} label={label} contrast={size === 'md' && s !== 'loading' && s !== 'focus-visible'} />
                      <span className="text-[11px] leading-3 text-ink-subtle">{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IconAndLabelDemo() {
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-[13px] font-medium text-ink-muted mb-2">Icon + label (page header / toolbar), trailing arrow, link</h4>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" icon={Upload}>Upload PDFs</Button>
          <Button variant="secondary" icon={Download}>Export</Button>
          <Button variant="secondary" icon={GitCompare} size="sm">Compare 2 invoices</Button>
          <Button variant="secondary" icon={Copy} size="sm">Copy</Button>
          <Button variant="ghost" icon={ArrowRight} size="sm">Next</Button>
          <Button variant="link" href="/dev/ui" iconEnd={ArrowRight}>View all invoices</Button>
        </div>
      </div>
      <div>
        <h4 className="text-[13px] font-medium text-ink-muted mb-2">Loading keeps its width (click to try; the button text and width do not change)</h4>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={Download}
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1800);
            }}
          >
            Save manual values now
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1800);
            }}
          >
            Save changes
          </Button>
        </div>
      </div>
      <div>
        <h4 className="text-[13px] font-medium text-ink-muted mb-2">Icon-only (always has a name + tooltip) — ghost and secondary × sm / md / lg</h4>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-x-3 border-spacing-y-3">
            <tbody>
              {(['ghost', 'secondary'] as const).flatMap((variant) =>
                SIZES.map((size) => (
                  <tr key={`${variant}-${size}`}>
                    <th scope="row" className="text-left text-[12px] font-normal text-ink-subtle pr-2 whitespace-nowrap">{variant} {size}</th>
                    <td><IconButton label="Edit invoice" icon={Pencil} variant={variant} size={size} data-contrast={size === 'md' ? `icon ${variant} · default` : undefined} /></td>
                    <td><IconButton label="Edit invoice" icon={Pencil} variant={variant} size={size} data-state="hover" data-contrast={size === 'md' ? `icon ${variant} · hover` : undefined} /></td>
                    <td><IconButton label="Edit invoice" icon={Pencil} variant={variant} size={size} data-state="active" /></td>
                    <td><IconButton label="Edit invoice" icon={Pencil} variant={variant} size={size} data-state="focus" /></td>
                    <td><IconButton label="Delete invoice" icon={Trash2} variant={variant} size={size} disabledReason="Nothing selected" /></td>
                    <td><IconButton label="Close" icon={X} variant={variant} size={size} loading /></td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-ink-subtle mt-1">Columns: default · hover · pressed · focus-visible · disabled (with reason) · loading. Hover over one for the tooltip.</p>
        <div className="flex gap-2 mt-3">
          <IconButton label="Previous month" icon={ChevronLeft} variant="ghost" />
          <IconButton label="Next month" icon={ChevronRight} variant="ghost" />
        </div>
      </div>
    </div>
  );
}
