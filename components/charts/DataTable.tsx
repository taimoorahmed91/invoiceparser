'use client';

import { cellText, type TableSpec } from '@/lib/dataView';
import { cx } from '@/components/ui/cx';

/** Accessible table for a panel's Table view (also the chart's text alternative). Sticky header, numbers right-aligned and tabular. */
export function DataTable({ table, caption, className, maxHeight }: { table: TableSpec; caption: string; className?: string; maxHeight?: number | string }) {
  return (
    <div className={cx('dv-table-wrap', className)} style={maxHeight ? { maxHeight } : undefined} tabIndex={0} role="region" aria-label={`${caption}, table`}>
      <table className="dv-table">
        <caption className="sr-only-text">{caption}</caption>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c.key} scope="col" className={c.align === 'right' ? 'text-right' : 'text-left'}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {table.columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row" className={c.align === 'right' ? 'text-right' : 'text-left'}>
                    {cellText(c, row)}
                  </th>
                ) : (
                  <td key={c.key} className={c.align === 'right' ? 'text-right' : 'text-left'}>
                    {cellText(c, row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
