'use client';

import { GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { selectionHint } from '@/lib/invoiceList';

/**
 * Appears when something is ticked (plan §4.3): "1 selected — pick one more to compare" / "2 selected · Compare · Clear".
 * Inline above the table; stuck to the bottom of the screen on phones (above the tab bar).
 */
export function SelectionBar({ count, onCompare, onClear }: { count: number; onCompare: () => void; onClear: () => void }) {
  return (
    <div className="inv-selbar no-print" role="region" aria-label="Selection">
      <p className="inv-selbar-text" role="status">{selectionHint(count)}</p>
      <div className="inv-selbar-actions">
        <Button variant="secondary" icon={GitCompare} disabledReason={count < 2 ? 'Select one more invoice' : undefined} onClick={onCompare}>
          Compare 2 invoices
        </Button>
        <Button variant="ghost" onClick={onClear}>Clear</Button>
      </div>
    </div>
  );
}
