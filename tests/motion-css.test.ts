import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(__dirname, '../app/controls.css'), 'utf8');

/** Returns the text of the first block that starts with `header { … }` (brace matched). */
function block(header: string, from = 0): string {
  const start = css.indexOf(header, from);
  expect(start).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error('unbalanced braces');
}

describe('press feedback (plan §2.6 rule 6)', () => {
  const press = block('@media (prefers-reduced-motion: no-preference)');

  it('uses the 95% / 90 ms / 360 ms values', () => {
    expect(css).toMatch(/--press-scale:\s*0\.95/);
    expect(css).toMatch(/--press-in:\s*90ms/);
    expect(css).toMatch(/--press-out:\s*360ms/);
  });

  it('scales only inside the no-preference media query, so reduced motion gets no scale at all', () => {
    const scaleHits = css.match(/transform:\s*scale\(var\(--press-scale\)\)/g) ?? [];
    expect(scaleHits).toHaveLength(1);
    expect(press).toContain('transform: scale(var(--press-scale))');
    // and the transform transition itself is also only declared there
    const outside = css.replace(press, '');
    expect(outside).not.toMatch(/transition-property:[^;]*transform/);
  });

  it('covers Button, IconButton (.btn), SegmentedControl items and ToggleChip', () => {
    expect(press).toContain('.btn, .seg-item, .chip');
  });

  it('reacts to :active, keyboard (data-pressed) and the gallery-forced state', () => {
    expect(press).toContain(':active');
    expect(press).toContain('[data-pressed="true"]');
    expect(press).toContain('[data-state="active"]');
  });

  it('never applies to disabled or loading controls', () => {
    expect(press).toContain(':not([aria-disabled="true"])');
    expect(press).toContain(':not([aria-busy="true"])');
  });

  it('moves nothing but transform (no layout properties in the pressed rule)', () => {
    const pressed = block(':is(.btn, .seg-item, .chip):is(:active', css.indexOf(press));
    expect(pressed).not.toMatch(/\b(width|height|margin|padding|top|left|border-width)\s*:/);
  });

  it('has a spring easing with a cubic-bezier fallback', () => {
    expect(css).toMatch(/--spring:\s*cubic-bezier\(\.34,\s*1\.56,\s*\.64,\s*1\)/);
    expect(css).toMatch(/@supports \(transition-timing-function: linear\(0, 1\)\)/);
    // the spring overshoots (a value above 1 exists) and ends at 1
    const curve = /--spring:\s*linear\(([^)]+)\)/.exec(css);
    expect(curve).not.toBeNull();
    const pts = curve![1].split(',').map(Number);
    expect(Math.max(...pts)).toBeGreaterThan(1);
    expect(pts[0]).toBe(0);
    expect(pts[pts.length - 1]).toBe(1);
  });
});

describe('rolling digits and reduced motion (plan §2.6 rule 5)', () => {
  it('strip transitions and entering animation are switched off under reduced motion', () => {
    const reduced = block('@media (prefers-reduced-motion: reduce) {\n    .roll-strip');
    expect(reduced).toMatch(/\.roll-strip\s*\{\s*transition:\s*none/);
    expect(reduced).toMatch(/animation:\s*none/);
  });
  it('uses tabular figures so widths stay stable', () => {
    expect(block('.rolling-number {')).toContain('font-variant-numeric: tabular-nums');
  });
  it('strips are not selectable and the text span is not read twice', () => {
    expect(block('.roll-strip {')).toContain('user-select: none');
  });
});
