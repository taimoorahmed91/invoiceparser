'use client';

import { useEffect, useState } from 'react';
import { composite, contrastRatio, parseColor, type RGBA } from '@/lib/contrast';

/**
 * Reads real computed colours from every element marked with data-contrast in the
 * gallery and checks them against WCAG (plan §2.7.11).
 *
 *   data-contrast="Primary / hover"        label shown in the table
 *   data-contrast-kind="text|border|custom" what to measure (default text)
 *   data-contrast-fg="--ink"               custom: a CSS variable used as the foreground
 *   data-contrast-bg="--surface"           optional: a CSS variable used as the background instead of walking ancestors
 * text  → color vs the element's own effective background, needs 4.5
 * border → border colour vs the effective background behind the element, needs 3
 * custom → the named variable vs the effective background behind the element, needs 3
 */
interface Row {
  theme: string;
  name: string;
  kind: string;
  ratio: number;
  need: number;
  pass: boolean;
}

function resolveVar(el: Element, name: string): RGBA | null {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  return resolveCss(raw);
}

function resolveCss(raw: string): RGBA | null {
  const probe = document.createElement('span');
  probe.style.color = raw;
  document.body.appendChild(probe);
  const out = parseColor(getComputedStyle(probe).color);
  probe.remove();
  return out;
}

function effectiveBackground(start: Element | null): RGBA {
  const layers: RGBA[] = [];
  for (let el: Element | null = start; el; el = el.parentElement) {
    const bg = parseColor(getComputedStyle(el).backgroundColor);
    if (bg && bg.a > 0) {
      layers.push(bg);
      if (bg.a >= 1) break;
    }
  }
  let base: RGBA = { r: 255, g: 255, b: 255, a: 1 };
  for (let i = layers.length - 1; i >= 0; i--) base = composite(layers[i], base);
  return base;
}

function measure(): Row[] {
  const rows: Row[] = [];
  document.querySelectorAll<HTMLElement>('[data-contrast]').forEach((el) => {
    const theme = el.closest('[data-theme-panel]')?.getAttribute('data-theme-panel') ?? '?';
    const name = el.getAttribute('data-contrast') ?? '';
    const kind = el.getAttribute('data-contrast-kind') ?? 'text';
    const cs = getComputedStyle(el);
    let fg: RGBA | null = null;
    let bg: RGBA;
    let need = 4.5;
    const bgVar = el.getAttribute('data-contrast-bg');

    if (kind === 'text') {
      bg = bgVar ? resolveVar(el, bgVar) ?? effectiveBackground(el) : effectiveBackground(el);
      fg = parseColor(cs.color);
    } else {
      need = 3;
      bg = bgVar ? resolveVar(el, bgVar) ?? effectiveBackground(el.parentElement) : effectiveBackground(el.parentElement);
      fg = kind === 'border' ? parseColor(cs.borderTopColor) : resolveVar(el, el.getAttribute('data-contrast-fg') ?? '--ink');
    }
    if (!fg) return;
    if (fg.a < 1) fg = composite(fg, bg);
    const ratio = contrastRatio(fg, bg);
    rows.push({ theme, name, kind, ratio, need, pass: ratio >= need });
  });
  return rows;
}

export function ContrastTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    // Wait for fonts/transitions so computed colours are final.
    const t = setTimeout(() => setRows(measure()), 400);
    const observer = new MutationObserver(() => {
      clearTimeout(t);
      setTimeout(() => setRows(measure()), 400);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, []);

  const failures = rows?.filter((r) => !r.pass) ?? [];

  return (
    <section aria-labelledby="contrast-h" className="mt-10">
      <h2 id="contrast-h" className="text-[20px] leading-7 font-semibold">
        Computed contrast
      </h2>
      <p className="text-ink-muted text-[14px] mb-3">
        Measured from the real rendered colours above. Text needs 4.5:1; borders, icons and the focus ring need 3:1.
      </p>
      <p
        data-testid="contrast-summary"
        data-failures={failures.length}
        data-total={rows?.length ?? 0}
        role="status"
        className={`inline-block rounded-md px-3 py-1.5 text-[14px] font-semibold mb-3 border ${
          rows === null ? 'border-border' : failures.length === 0 ? 'border-ink' : 'border-danger text-danger'
        }`}
      >
        {rows === null ? 'Measuring…' : `${rows.length} pairs checked · ${failures.length} failures`}
      </p>
      {rows && (
        <div className="overflow-x-auto border border-border rounded-lg bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left bg-surface-2">
                <th className="px-3 py-2 font-medium">Theme</th>
                <th className="px-3 py-2 font-medium">Pair</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium text-right">Ratio</th>
                <th className="px-3 py-2 font-medium text-right">Needs</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border" data-pass={r.pass}>
                  <td className="px-3 py-1.5">{r.theme}</td>
                  <td className="px-3 py-1.5">{r.name}</td>
                  <td className="px-3 py-1.5">{r.kind === 'text' ? 'text' : 'non-text'}</td>
                  <td className="px-3 py-1.5 text-right">{r.ratio.toFixed(2)}:1</td>
                  <td className="px-3 py-1.5 text-right">{r.need}:1</td>
                  <td className={`px-3 py-1.5 font-semibold ${r.pass ? '' : 'text-danger'}`}>{r.pass ? 'Pass' : 'FAIL'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
