import { ArrowDown, ArrowUp } from 'lucide-react';

/**
 * The button inside a sortable column header (plan §2.7.10). The <th> carries aria-sort; this is the control.
 * The arrow lives in a reserved 16 px slot, so the header text never shifts when the sort changes.
 */
export function SortButton({ label, direction, onClick, align = 'left' }: { label: string; direction: 'ascending' | 'descending' | 'none'; onClick: () => void; align?: 'left' | 'right' }) {
  return (
    <button type="button" className="sort-btn print-keep" data-align={align} data-sorted={direction !== 'none' ? 'true' : undefined} onClick={onClick}>
      <span>{label}</span>
      <span className="sort-slot" aria-hidden="true">
        {direction === 'ascending' && <ArrowUp size={14} strokeWidth={2} />}
        {direction === 'descending' && <ArrowDown size={14} strokeWidth={2} />}
      </span>
    </button>
  );
}
