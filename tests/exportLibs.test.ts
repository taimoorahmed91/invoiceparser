import { describe, it, expect } from 'vitest';
import { tableToCsv, chartSpecToCsv, tableSpecToCsv } from '../lib/csv';
import { pageCss, printTitle, footerParts, POLISH_GLYPHS } from '../lib/pdf';
import { nestChartSvg, escapeXml, layoutLegend, exportSize, fontFaceCss, composeExportSvg, approxTextWidth, PNG_PADDING } from '../lib/png';
import type { TimeSeriesSpec } from '../lib/dataView';

describe('csv', () => {
  it('quotes every cell, escapes quotes, starts with a BOM, keeps Polish letters', () => {
    const csv = tableToCsv(['Opis', 'Kwota'], [['Centralne ogrzewanie "GJ"', 1234.5], ['Zimna woda', 10], ['x', null]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1).split('\n')).toEqual(['"Opis","Kwota"', '"Centralne ogrzewanie ""GJ""","1234.50"', '"Zimna woda","10"', '"x",""']);
  });
  it('chart data → Month, series columns, Total', () => {
    const spec: TimeSeriesSpec = {
      xKey: 'month', xLabel: 'Month', showTotal: true,
      series: [{ key: 'Rent', label: 'Rent', color: 'x' }, { key: 'Utility', label: 'Utility', color: 'y' }],
      rows: [{ month: 'Nov 2026', Rent: 4700, Utility: 1262.3 }, { month: 'Dec 2026', Rent: 0, Utility: null }],
    };
    expect(chartSpecToCsv(spec).slice(1).split('\n')).toEqual(['"Month","Rent","Utility","Total"', '"Nov 2026","4700","1262.30","5962.30"', '"Dec 2026","0","","0"']);
  });
  it('table spec uses raw values, not display formatting', () => {
    const csv = tableSpecToCsv({ columns: [{ key: 'a', label: 'A', format: () => 'FORMATTED' }], rows: [{ a: 3.456 }] });
    expect(csv.slice(1)).toBe('"A"\n"3.46"');
  });
});

describe('pdf helpers', () => {
  it('portrait by default, landscape for wide panels, 18 mm margins', () => {
    expect(pageCss(false)).toBe('@page { size: A4 portrait; margin: 18mm; }');
    expect(pageCss(true)).toBe('@page { size: A4 landscape; margin: 18mm; }');
  });
  it('title and footer strings', () => {
    expect(printTitle('Monthly costs')).toBe('Invoice Parser — Monthly costs');
    expect(footerParts(new Date(2026, 10, 3, 9, 5))).toEqual({ left: 'Generated 2026-11-03 09:05', right: 'Invoice Parser' });
  });
  it('checks every Polish letter', () => {
    for (const ch of 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ') expect(POLISH_GLYPHS).toContain(ch);
  });
});

describe('png helpers', () => {
  it('escapes XML', () => {
    expect(escapeXml(`a & <b> "c" 'd'`)).toBe('a &amp; &lt;b&gt; &quot;c&quot; &apos;d&apos;');
    expect(escapeXml('Zimna woda — łąka')).toBe('Zimna woda — łąka');
  });
  it('legend wraps into rows inside the chart width', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ label: `Central Heating ${i}`, color: '#000' }));
    const { placed, rows } = layoutLegend(items, 400);
    expect(rows).toBeGreaterThan(1);
    expect(placed[0]).toMatchObject({ x: 0, row: 0 });
    expect(placed.every((p) => p.x + 18 + approxTextWidth(p.label, 13) <= 400 + 1)).toBe(true);
    expect(layoutLegend([], 400)).toEqual({ placed: [], rows: 0 });
  });
  it('export size adds padding, header and legend rows', () => {
    const a = exportSize({ chartWidth: 800, chartHeight: 400, hasSubtitle: false, legendRows: 0 });
    const b = exportSize({ chartWidth: 800, chartHeight: 400, hasSubtitle: true, legendRows: 2 });
    expect(a.width).toBe(800 + PNG_PADDING * 2);
    expect(b.height).toBeGreaterThan(a.height);
  });
  it('font-face css has both latin and latin-ext under one family', () => {
    const css = fontFaceCss([{ weight: 400, range: 'latin', base64: 'AAA' }, { weight: 600, range: 'latin-ext', base64: 'BBB' }]);
    expect(css).toContain("font-family:'Fira Sans'");
    expect(css).toContain('font-weight:400');
    expect(css).toContain('font-weight:600');
    expect(css).toContain('U+0100-02AF'); // latin-ext (ł U+0142)
    expect(css).toContain('base64,AAA');
  });
  it('nesting replaces the chart svg size and position (no duplicate attributes)', () => {
    const out = nestChartSvg('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420" class="a"><g/></svg>', 24, 80, 960, 420);
    expect(out).toBe('<svg x="24" y="80" width="960" height="420" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 420" class="a"><g/></svg>');
    expect((out.match(/ width=/g) ?? []).length).toBe(1);
  });
  it('composes a self-contained SVG with escaped title, legend and chart', () => {
    const svg = composeExportSvg({
      chartSvg: '<svg width="800" height="400"><rect/></svg>', chartWidth: 800, chartHeight: 400,
      title: 'Centralne ogrzewanie & woda', subtitle: 'Nov 2025 – Nov 2026',
      legend: [{ label: 'Gospodarka odpadami', color: '#4C8C4A' }], fontCss: '@font-face{}',
    });
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('Centralne ogrzewanie &amp; woda');
    expect(svg).toContain('Gospodarka odpadami');
    expect(svg).toContain(`<svg x="${PNG_PADDING}"`);
    expect(svg).toContain('@font-face{}');
    expect(svg).toContain('fill="#FFFFFF"');
  });
});
