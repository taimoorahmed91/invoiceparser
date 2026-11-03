import { PrintChart } from './PrintChart';
import { PrintTable } from './PrintTable';
import { footerParts, printTitle } from '@/lib/pdf';
import type { ReportData } from '@/lib/analyticsReport';

export const REPORT_WIDTH = 658; // A4 portrait with 18 mm margins, in CSS px
const GAP = 12;
const HALF = Math.floor((REPORT_WIDTH - GAP) / 2);

/** A multi-page report (plan §4.12.4): cover line, then one section per tab, each section on its own page. */
export function PrintReport({ data, now = new Date() }: { data: ReportData; now?: Date }) {
  const footer = footerParts(now);
  return (
    <article className="print-panel print-report">
      <header>
        <h1>{printTitle(data.title)}</h1>
        <p className="print-meta">{data.meta}</p>
      </header>
      {data.sections.map((s) => (
        <section key={s.id} className="print-section">
          <h2>{s.title}</h2>
          {s.subtitle && <p className="print-sub">{s.subtitle}</p>}
          {s.leadTables?.map((t) => (
            <div key={t.title} className="print-table-block">
              <h3>{t.title}</h3>
              <PrintTable table={t.table} caption={`${s.title}: ${t.title}`} />
            </div>
          ))}
          {s.charts.length > 0 && (
            <div className="print-grid">
              {s.charts.map((c) => (
                <div key={c.title} className={c.half ? 'print-cell' : 'print-cell print-cell-full'}>
                  <h3>{c.title}</h3>
                  {c.subtitle && <p className="print-sub-small">{c.subtitle}</p>}
                  <PrintChart spec={c.spec} chartType={c.chartType} width={c.half ? HALF : REPORT_WIDTH} height={c.height ?? (c.half ? 190 : 300)} legend={c.spec.series.length > 1} />
                </div>
              ))}
            </div>
          )}
          {s.tables.map((t) => (
            <div key={t.title} className="print-table-block">
              <h3>{t.title}</h3>
              <PrintTable table={t.table} caption={`${s.title}: ${t.title}`} />
            </div>
          ))}
          {s.note && <p className="print-note">{s.note}</p>}
        </section>
      ))}
      <footer className="print-footer">
        <span>{footer.left}</span>
        <span>{footer.right}</span>
      </footer>
    </article>
  );
}
