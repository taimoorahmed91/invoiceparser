import { cellText, type TableSpec } from '@/lib/dataView';

/** Semantic table with a header that repeats on every printed page. */
export function PrintTable({ table, caption }: { table: TableSpec; caption: string }) {
  return (
    <table className="print-table">
      <caption className="sr-only-text">{caption}</caption>
      <thead>
        <tr>
          {table.columns.map((c) => (
            <th key={c.key} scope="col" className={c.align === 'right' ? 'num' : undefined}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>
            {table.columns.map((c) => (
              <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                {cellText(c, row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
