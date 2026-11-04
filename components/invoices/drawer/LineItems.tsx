'use client';

import { useMemo, useState } from 'react';
import { Pencil, TrendingDown } from 'lucide-react';
import { DataPanel } from '@/components/charts/DataPanel';
import { DataTable } from '@/components/charts/DataTable';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { LineItemRowView, LineItemView } from '@/lib/adjustments';
import { fmtDate, fmtMoney, fmtQuantity } from '@/lib/format';
import { hasPolish, lineItemsSpec } from '@/lib/invoiceDetail';
import type { StoredInvoice } from '@/lib/storage';

type Mode = 'compact' | 'full';
const MODE_KEY = 'invoice-parser-line-items';

function readMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === 'full' ? 'full' : 'compact';
  } catch {
    return 'compact';
  }
}

/** "Adjusted −138,32 zł" / "Added manually": a pill with an icon and words, never colour alone. */
function Pill({ row, currency }: { row: LineItemRowView; currency: string }) {
  if (row.kind === 'adjusted') {
    return (
      <span className="li-pill" data-kind="adjusted">
        <TrendingDown size={14} strokeWidth={1.75} aria-hidden="true" />
        Adjusted {fmtMoney(-row.reduction, currency)}
      </span>
    );
  }
  if (row.kind === 'manual') {
    return (
      <span className="li-pill" data-kind="manual">
        <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
        Added manually
      </span>
    );
  }
  return null;
}

function Description({ row, currency }: { row: LineItemRowView; currency: string }) {
  return (
    <>
      <span lang={hasPolish(row.item.description) ? 'pl' : undefined}>{row.item.description}</span>
      {row.kind !== 'normal' && <>{' '}<Pill row={row} currency={currency} /></>}
    </>
  );
}

function Compact({ view, currency }: { view: LineItemView; currency: string }) {
  return (
    <ul className="li-compact" aria-label="Line items">
      {view.rows.map((row, i) => (
        <li key={i} className="li-row" data-kind={row.kind}>
          <div className="li-main">
            <p className="li-desc"><Description row={row} currency={currency} /></p>
            <p className="li-cap">
              {fmtQuantity(row.item.quantity, row.item.unit)} × {fmtMoney(row.item.netPrice, currency)}
              {row.item.tax ? ` · tax ${row.item.tax}` : ''}
            </p>
          </div>
          <div className="li-amount">
            <span className="li-gross">{fmtMoney(row.item.grossValue, currency)}</span>
            {row.kind === 'adjusted' && row.original && <span className="li-was">was {fmtMoney(row.original.grossValue, currency)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The line items (plan §4.4, F29) as a DataPanel: Export (CSV / PDF), Expand, and a Chart | Table switch whose Chart is off because
 * one invoice's lines are not a time series (§4.9). Compact (default, fits the drawer) or Full columns (the 7-column table).
 * `view` already holds the manual-heating rows exactly as the old table showed them (computeLineItemView).
 */
export function LineItems({ stored, view }: { stored: StoredInvoice; view: LineItemView }) {
  const inv = stored.invoice;
  const currency = inv.currency || 'PLN';
  const phone = useMediaQuery('(max-width: 639px)');
  const [mode, setModeState] = useState<Mode>(readMode);
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      /* private mode: the choice lasts until the page closes */
    }
  };
  const table = useMemo(() => lineItemsSpec(view, currency), [view, currency]);

  if (view.rows.length === 0) {
    return (
      <section className="id-section">
        <h3 className="id-h">Line items</h3>
        <p className="id-empty">No line items found in this invoice.</p>
      </section>
    );
  }

  const full = (
    <DataTable
      table={table}
      caption={`Line items of ${inv.invoiceNumber}`}
      renderCell={(c, _row, i) => (c.key === 'description' ? <Description row={view.rows[i]} currency={currency} /> : undefined)}
    />
  );

  return (
    <section className="id-section id-lines">
      <DataPanel
        title="Line items"
        headingLevel={3}
        subtitle={`${view.rows.length} ${view.rows.length === 1 ? 'line' : 'lines'}`}
        storageKey="invoice.line-items"
        table={table}
        chartDisabledReason="One invoice’s lines are not a time series, so there is no chart for them."
        range={`${inv.invoiceNumber}${inv.issueDate ? ` · issued ${fmtDate(inv.issueDate)}` : ''}`}
        filters="Heating adjustments from manual values are shown"
        chartHeight={0}
        viewExtra={
          <SegmentedControl<Mode>
            aria-label="Line item layout"
            size="sm"
            value={mode}
            onChange={setMode}
            options={[{ value: 'compact', label: 'Compact' }, { value: 'full', label: 'Full columns' }]}
          />
        }
        // full screen is for the wide table, except on a phone where seven columns do not fit: there it keeps the chosen layout
        renderTable={({ fullscreen }) => ((mode === 'compact' && (!fullscreen || phone)) ? <Compact view={view} currency={currency} /> : full)}
      />
    </section>
  );
}
