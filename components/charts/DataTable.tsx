'use client';

import type { ReactNode } from 'react';
import { cellText, type DataRow, type TableColumn, type TableSpec } from '@/lib/dataView';
import { cx } from '@/components/ui/cx';

/**
 * Accessible table for a panel's Table view (also the chart's text alternative). Sticky header, numbers right-aligned and tabular.
 * `renderCell` lets a screen show something richer than text in a cell (an input); return undefined to use the text.
 * Export (CSV / PDF) never uses it: it always reads the spec's text.
 */
export function DataTable({
  table, caption, className, maxHeight, renderCell,
}: {
  table: TableSpec;
  caption: string;
  className?: string;
  maxHeight?: number | string;
  renderCell?: (column: TableColumn, row: DataRow, rowIndex: number) => ReactNode | undefined;
}) {
  const content = (c: TableColumn, row: DataRow, i: number): ReactNode => renderCell?.(c, row, i) ?? cellText(c, row);
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
                    {content(c, row, i)}
                  </th>
                ) : (
                  <td key={c.key} className={c.align === 'right' ? 'text-right' : 'text-left'}>
                    {content(c, row, i)}
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
