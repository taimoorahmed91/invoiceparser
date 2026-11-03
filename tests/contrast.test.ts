import { describe, it, expect } from 'vitest';
import { parseColor, contrastRatio, composite } from '../lib/contrast';

const c = (s: string) => parseColor(s)!;

describe('contrast maths', () => {
  it('black on white is 21:1, same colour is 1:1', () => {
    expect(contrastRatio(c('#000'), c('#fff'))).toBeCloseTo(21, 1);
    expect(contrastRatio(c('#777'), c('#777'))).toBeCloseTo(1, 5);
  });
  it('parses the rgb notations browsers return', () => {
    expect(c('rgb(255, 138, 122)')).toEqual({ r: 255, g: 138, b: 122, a: 1 });
    expect(c('rgb(255 138 122 / 0.14)').a).toBeCloseTo(0.14);
    expect(c('rgba(0,0,0,.5)').a).toBe(0.5);
  });
  it('composites a translucent tint over a surface', () => {
    const out = composite({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(out.r).toBeCloseTo(127.5);
    expect(out.a).toBe(1);
  });
  // The plan's own claims (§2.2 / §2.7.2) — keep them honest.
  it.each([
    ['ink on white', '#1B1F24', '#FFFFFF', 16.6],
    ['white on danger', '#FFFFFF', '#B42318', 6.6],
    ['dark on danger (dark)', '#0E1116', '#FF8A7A', 8.2],
    ['dark on danger-active (dark)', '#0E1116', '#F2705F', 6.5],
    ['focus ring light on white', '#1D4ED8', '#FFFFFF', 6.7],
  ])('%s ≈ %s', (_n, fg, bg, expected) => {
    expect(contrastRatio(c(fg as string), c(bg as string))).toBeCloseTo(expected as number, 0);
  });
  it('control border keeps ≥ 3:1 on every surface it can sit on (light and dark)', () => {
    for (const bg of ['#FFFFFF', '#F4F4F1', '#EDEDE8']) expect(contrastRatio(c('#7F8690'), c(bg))).toBeGreaterThanOrEqual(3);
    for (const bg of ['#151A21', '#0E1116', '#1C232C']) expect(contrastRatio(c('#6B7686'), c(bg))).toBeGreaterThanOrEqual(3);
    // the plan's original light value fails on the canvas:
    expect(contrastRatio(c('#8A9099'), c('#F4F4F1'))).toBeLessThan(3);
  });
  it('all state colours keep ≥ 4.5:1 text contrast (light)', () => {
    const pairs: Array<[string, string]> = [
      ['#FFFFFF', '#1B1F24'], ['#FFFFFF', '#2D333A'], ['#FFFFFF', '#0D0F12'],
      ['#FFFFFF', '#B42318'], ['#FFFFFF', '#9A1D14'], ['#FFFFFF', '#7F170F'],
      ['#B42318', '#FCE9E7'], ['#B42318', '#F8D2CE'],
      ['#636A73', '#EDEDE8'],
    ];
    for (const [fg, bg] of pairs) expect(contrastRatio(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5);
  });
  it('all state colours keep ≥ 4.5:1 text contrast (dark)', () => {
    const pairs: Array<[string, string]> = [
      ['#0E1116', '#E8EAED'], ['#0E1116', '#F3F4F6'], ['#0E1116', '#D0D4D9'],
      ['#0E1116', '#FF8A7A'], ['#0E1116', '#FFA091'], ['#0E1116', '#F2705F'],
      ['#8D96A2', '#1C232C'],
    ];
    for (const [fg, bg] of pairs) expect(contrastRatio(c(fg), c(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
