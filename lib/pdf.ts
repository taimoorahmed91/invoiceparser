/**
 * PDF export by the browser's own print pipeline (plan §4.12). No dependency:
 * a light-themed #print-root is rendered (components/print/*), everything else is hidden by the
 * scoped @media print rules in globals.css, and window.print() opens "Save as PDF".
 * Pure helpers first (tested), then the browser orchestration.
 */

/** @page rule for the print dialog: A4, 18 mm margins, landscape for wide tables. */
export function pageCss(wide: boolean): string {
  return `@page { size: A4 ${wide ? 'landscape' : 'portrait'}; margin: 18mm; }`;
}

export function printTitle(panelTitle: string): string {
  return `Invoice Parser — ${panelTitle}`;
}

/** Footer text: left "Generated 2026-11-03 14:02", right "Invoice Parser". No page counters (not reliable across browsers). */
export function footerParts(date: Date = new Date()): { left: string; right: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    left: `Generated ${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`,
    right: 'Invoice Parser',
  };
}

/** Polish letters used to make sure the latin-ext face is really loaded before printing. */
export const POLISH_GLYPHS = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';

export const PRINT_ATTR = 'data-print-export';
export const PRINT_STYLE_ID = 'print-page-style';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Waits until both Fira Sans weights (incl. latin-ext) are painted, so ł ą ś … do not fall back. */
export async function ensurePrintFonts(): Promise<void> {
  const family = getComputedStyle(document.body).fontFamily;
  try {
    await Promise.all([
      document.fonts.load(`400 12px ${family}`, POLISH_GLYPHS),
      document.fonts.load(`600 12px ${family}`, POLISH_GLYPHS),
      document.fonts.load(`400 12px ${family}`, '0123456789'),
    ]);
    await document.fonts.ready;
  } catch {
    /* printing with a fallback font is better than not printing */
  }
}

/** Marks the document as "printing a panel" and sets the page size. Returns the undo function. */
export function beginPrintMode(wide: boolean): () => void {
  const html = document.documentElement;
  let style = document.getElementById(PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = pageCss(wide);
  html.setAttribute(PRINT_ATTR, 'true');
  return () => {
    html.removeAttribute(PRINT_ATTR);
    document.getElementById(PRINT_STYLE_ID)?.remove();
  };
}

/**
 * Prints the #print-root that is currently mounted. Lifecycle (plan §4.12.2):
 * 1. leave native full screen (caller closes the dialog first)   2. wait for fonts
 * 3. mark <html data-print-export> and set @page                    4. window.print()
 * 5. on afterprint: unmark, resolve (caller unmounts the print tree and restores focus)
 */
export async function printMountedRoot(opts: { wide: boolean }): Promise<void> {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }
  await ensurePrintFonts();
  await nextFrame();
  await nextFrame();
  const undo = beginPrintMode(opts.wide);
  await new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener('afterprint', done);
      resolve();
    };
    window.addEventListener('afterprint', done);
    window.print();
  });
  undo();
}
