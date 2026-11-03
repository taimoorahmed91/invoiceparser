import type { ReactNode } from 'react';
import { footerParts, printTitle } from '@/lib/pdf';

/** Page layout of a single exported panel (plan §4.12.3): title, subtitle, range · filters, content, footer. */
export function PrintPanel({ title, subtitle, range, filters, children, now = new Date() }: {
  title: string;
  subtitle?: string;
  range?: string;
  filters?: string;
  children: ReactNode;
  now?: Date;
}) {
  const footer = footerParts(now);
  const meta = [range && `Range: ${range}`, filters && `Filters: ${filters}`].filter(Boolean).join('   ·   ');
  return (
    <article className="print-panel">
      <header>
        <h1>{printTitle(title)}</h1>
        {subtitle && <p className="print-sub">{subtitle}</p>}
        {meta && <p className="print-meta">{meta}</p>}
      </header>
      <div className="print-body">{children}</div>
      <footer className="print-footer">
        <span>{footer.left}</span>
        <span>{footer.right}</span>
      </footer>
    </article>
  );
}
