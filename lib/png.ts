/**
 * PNG export of a chart (plan §4.12.1): serialize the chart's <svg> (from the light print tree),
 * embed Fira Sans as base64 @font-face so Polish letters survive (a canvas does not inherit the page's
 * next/font), draw title + legend + chart into one SVG, rasterize at 2× on a canvas.
 * Pure string builders first (tested), browser steps below.
 */
export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Rough text width for layout (Fira Sans averages ≈ 0.55 em). Good enough to wrap legend rows. */
export function approxTextWidth(text: string, fontSize: number): number {
  return Math.ceil(text.length * fontSize * 0.55);
}

export interface LegendItem {
  label: string;
  color: string;
}
export interface PlacedLegendItem extends LegendItem {
  x: number;
  row: number;
}

const LEGEND_FONT = 13;
const SWATCH = 12;
const GAP = 22;

/** Lays legend items out left to right, wrapping to new rows inside `maxWidth`. */
export function layoutLegend(items: LegendItem[], maxWidth: number): { placed: PlacedLegendItem[]; rows: number } {
  const placed: PlacedLegendItem[] = [];
  let x = 0;
  let row = 0;
  for (const item of items) {
    const w = SWATCH + 6 + approxTextWidth(item.label, LEGEND_FONT);
    if (x > 0 && x + w > maxWidth) {
      row += 1;
      x = 0;
    }
    placed.push({ ...item, x, row });
    x += w + GAP;
  }
  return { placed, rows: items.length === 0 ? 0 : row + 1 };
}

export const PNG_PADDING = 24;
const TITLE_H = 34;
const SUBTITLE_H = 22;
const LEGEND_ROW_H = 24;

export function exportSize(opts: { chartWidth: number; chartHeight: number; hasSubtitle: boolean; legendRows: number }) {
  const header = PNG_PADDING + TITLE_H + (opts.hasSubtitle ? SUBTITLE_H : 0) + 8;
  const legend = opts.legendRows > 0 ? 8 + opts.legendRows * LEGEND_ROW_H : 0;
  return {
    width: opts.chartWidth + PNG_PADDING * 2,
    height: header + opts.chartHeight + legend + PNG_PADDING,
    chartY: header,
    legendY: header + opts.chartHeight + 8,
  };
}

/** Embedded fonts: same unicode ranges as Google/fontsource so latin and latin-ext faces share one family name. */
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

export interface FontFile {
  weight: 400 | 600;
  range: 'latin' | 'latin-ext';
  base64: string;
}

export function fontFaceCss(files: FontFile[]): string {
  return files
    .map(
      (f) =>
        `@font-face{font-family:'Fira Sans';font-style:normal;font-weight:${f.weight};src:url(data:font/woff2;base64,${f.base64}) format('woff2');unicode-range:${f.range === 'latin' ? LATIN : LATIN_EXT};}`,
    )
    .join('');
}

/** Positions the chart <svg> inside the page <svg>. Its own x / y / width / height are replaced (duplicate attributes make the XML invalid). */
export function nestChartSvg(chartSvg: string, x: number, y: number, width: number, height: number): string {
  return chartSvg.replace(/^<svg\b([^>]*)>/, (_m, attrs: string) => {
    const kept = attrs.replace(/\s(?:x|y|width|height)="[^"]*"/g, '');
    return `<svg x="${x}" y="${y}" width="${width}" height="${height}"${kept}>`;
  });
}

export interface ComposeInput {
  chartSvg: string; // outer HTML of the (style-inlined) chart <svg>
  chartWidth: number;
  chartHeight: number;
  title: string;
  subtitle?: string;
  legend: LegendItem[];
  fontCss: string;
  ink?: string;
  inkMuted?: string;
  background?: string;
}

/** One self-contained SVG: white page, title, optional subtitle, chart, legend. All text in Fira Sans. */
export function composeExportSvg(i: ComposeInput): string {
  const ink = i.ink ?? '#1B1F24';
  const muted = i.inkMuted ?? '#555C65';
  const bg = i.background ?? '#FFFFFF';
  const { placed, rows } = layoutLegend(i.legend, i.chartWidth);
  const size = exportSize({ chartWidth: i.chartWidth, chartHeight: i.chartHeight, hasSubtitle: Boolean(i.subtitle), legendRows: rows });
  const nested = nestChartSvg(i.chartSvg, PNG_PADDING, size.chartY, i.chartWidth, i.chartHeight);
  const legendSvg = placed
    .map((p) => {
      const y = size.legendY + p.row * LEGEND_ROW_H;
      return `<rect x="${PNG_PADDING + p.x}" y="${y + 2}" width="${SWATCH}" height="${SWATCH}" rx="2" fill="${escapeXml(p.color)}"/><text x="${PNG_PADDING + p.x + SWATCH + 6}" y="${y + 13}" font-size="${LEGEND_FONT}" fill="${muted}">${escapeXml(p.label)}</text>`;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}" font-family="'Fira Sans', sans-serif">` +
    `<defs><style>${i.fontCss}</style></defs>` +
    `<rect width="100%" height="100%" fill="${bg}"/>` +
    `<text x="${PNG_PADDING}" y="${PNG_PADDING + 22}" font-size="20" font-weight="600" fill="${ink}">${escapeXml(i.title)}</text>` +
    (i.subtitle ? `<text x="${PNG_PADDING}" y="${PNG_PADDING + TITLE_H + 14}" font-size="13" fill="${muted}">${escapeXml(i.subtitle)}</text>` : '') +
    nested +
    legendSvg +
    `</svg>`
  );
}

/* ---------------- browser steps ---------------- */

const FONT_FILES: Array<{ file: string; weight: 400 | 600; range: 'latin' | 'latin-ext' }> = [
  { file: 'FiraSans-400-latin', weight: 400, range: 'latin' },
  { file: 'FiraSans-400-latin-ext', weight: 400, range: 'latin-ext' },
  { file: 'FiraSans-600-latin', weight: 600, range: 'latin' },
  { file: 'FiraSans-600-latin-ext', weight: 600, range: 'latin-ext' },
];
let fontCache: Promise<string> | null = null;

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  return btoa(bin);
}

/** Fetches /fonts/*.woff2 once and returns the @font-face CSS. Throws if a font cannot be loaded (R15: never export a wrong font silently). */
export function loadEmbeddedFontCss(): Promise<string> {
  if (!fontCache) {
    fontCache = Promise.all(
      FONT_FILES.map(async (f) => {
        const res = await fetch(`/fonts/${f.file}.woff2`);
        if (!res.ok) throw new Error(`Could not load font ${f.file}`);
        return { weight: f.weight, range: f.range, base64: toBase64(await res.arrayBuffer()) } as FontFile;
      }),
    ).then(fontFaceCss);
    fontCache.catch(() => {
      fontCache = null;
    });
  }
  return fontCache;
}

const COPY_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline'];

/** Copies resolved (computed) paint onto a clone, so CSS variables and classes do not matter once it is a standalone image. */
export function inlineComputedStyles(original: Element, clone: Element): void {
  const o = [original, ...Array.from(original.querySelectorAll('*'))];
  const c = [clone, ...Array.from(clone.querySelectorAll('*'))];
  o.forEach((el, i) => {
    const target = c[i] as SVGElement | undefined;
    if (!target) return;
    const cs = getComputedStyle(el);
    const parts = COPY_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).filter((s) => !s.endsWith(':'));
    target.setAttribute('style', parts.join(';'));
    target.removeAttribute('class');
    target.removeAttribute('fill-opacity') /* style carries it */;
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render the chart image'));
    img.src = url;
  });
}

export interface PngInput {
  svg: SVGSVGElement;
  title: string;
  subtitle?: string;
  legend: LegendItem[];
  scale?: number;
}

/** Chart <svg> → PNG blob (2× by default, white background). */
export async function chartToPngBlob({ svg, title, subtitle, legend, scale = 2 }: PngInput): Promise<Blob> {
  const fontCss = await loadEmbeddedFontCss();
  const box = svg.getBoundingClientRect();
  const w = Math.round(box.width || Number(svg.getAttribute('width')) || 800);
  const h = Math.round(box.height || Number(svg.getAttribute('height')) || 400);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
  clone.removeAttribute('style');
  const out = composeExportSvg({ chartSvg: new XMLSerializer().serializeToString(clone), chartWidth: w, chartHeight: h, title, subtitle, legend, fontCss });
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(out);

  const canvas = document.createElement('canvas');
  const sizeMatch = /width="(\d+)" height="(\d+)" viewBox/.exec(out);
  const cw = Number(sizeMatch?.[1] ?? w);
  const ch = Number(sizeMatch?.[2] ?? h);
  canvas.width = cw * scale;
  canvas.height = ch * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  // An SVG image with embedded fonts needs a first load to decode the fonts; draw after a second, warm load.
  await loadImage(url);
  const img = await loadImage(url);
  if ('decode' in img) await img.decode().catch(() => undefined);
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, cw, ch);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}
