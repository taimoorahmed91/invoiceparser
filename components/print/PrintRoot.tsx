'use client';

import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/**
 * The light-themed tree that is printed or rasterised (plan §4.12.2). Rendered into <body> only while an export runs.
 * On screen it sits off-screen (but laid out, so charts can be measured); the scoped @media print rules in globals.css
 * show it and hide everything else. `.light` pins the light tokens regardless of the user's theme.
 */
export function PrintRoot({ children, widthPx }: { children: ReactNode; widthPx: number }) {
  return createPortal(
    <div id="print-root" className="light" aria-hidden="true" style={{ ['--print-w' as string]: `${widthPx}px` }}>
      {children}
    </div>,
    document.body,
  );
}
