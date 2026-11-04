'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { FileUp, SearchX } from 'lucide-react';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/toast/ToastProvider';
import { useUpload } from '@/components/upload/UploadProvider';
import { useInvoiceFilters } from '@/hooks/useFilters';
import { useInvoiceDrawer } from '@/hooks/useInvoiceDrawer';
import { useInvoices } from '@/hooks/useInvoices';
import { useManualValues } from '@/hooks/useManualValues';
import { dataMonthsYm } from '@/lib/analyticsOverview';
import { applyFilters } from '@/lib/filters';
import { neighbourAfterRemove, neighbours } from '@/lib/invoiceDetail';
import { fmtMoney } from '@/lib/format';
import { DEFAULT_SORT, describeFilters, isTextEntry, nextSort, periodLabel, resultStats, sortList, toggleSelected, typeCounts, type ListSort, type SortField } from '@/lib/invoiceList';
import type { StoredInvoice } from '@/lib/storage';
import { FilterBar } from './FilterBar';
import { ListExport } from './ListExport';
import { SelectionBar } from './SelectionBar';
import type { InvoiceListHandlers } from './InvoiceTable';

// The list is a DataPanel, and its "Show as chart" view draws with Recharts (the heaviest client dependency): load it on demand (plan §6.3).
const InvoicesPanel = dynamic(() => import('./InvoicesPanel'), {
  ssr: false,
  loading: () => <Skeleton height={480} label="Loading invoices" />,
});

// The drawer and Compare hold DataPanels (Recharts comes with them): fetched when one is first opened, not with the list.
const InvoiceDrawer = dynamic(() => import('./drawer/InvoiceDrawer').then((m) => m.InvoiceDrawer), { ssr: false });
const CompareDialog = dynamic(() => import('./CompareDialog').then((m) => m.CompareDialog), { ssr: false });

function Loading() {
  return (
    <div className="inv-page" aria-busy="true">
      <Skeleton height={140} label="Loading filters" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={56} label="Loading invoice" />
        ))}
      </div>
    </div>
  );
}

const rowButtonOf = (id: string): HTMLElement | null => {
  const rows = document.querySelectorAll<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);
  // with the list also open in full screen, the visible one is the last one in the page
  return rows.length ? rows[rows.length - 1].querySelector<HTMLElement>('.inv-num') : null;
};

/** The number button of the row whose menu item was just chosen (focus is inside that row's menu). */
const openerFromFocus = (): HTMLElement | null => document.activeElement?.closest('[data-row-id]')?.querySelector<HTMLElement>('.inv-num') ?? null;

/**
 * Invoices (plan §4.3): sticky filter bar, result strip, the list as a DataPanel, row actions, selection for Compare, Export menu.
 * One invoice opens in the drawer (`?invoice=<id>`, plan §4.4). Compare is a dialog (plan §4.5).
 */
export function InvoicesPage() {
  const { invoices, status, error, reload, remove, update, undo, canUndo } = useInvoices();
  const { values: manualValues } = useManualValues();
  const toast = useToast();
  const upload = useUpload();
  const { filters, set, clear } = useInvoiceFilters();
  const [sort, setSort] = useState<ListSort>(DEFAULT_SORT);
  const [selected, setSelected] = useState<string[]>([]);
  const drawer = useInvoiceDrawer();
  const [editOnOpen, setEditOnOpen] = useState(false);
  /** The row's number button that opened the drawer, and where focus goes instead after a delete (the invoice now in its place). */
  const openerRef = useRef<HTMLElement | null>(null);
  const focusAfterRef = useRef<string | null>(null);
  const deletedRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const [compare, setCompare] = useState<{ opener: HTMLElement | null } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const dataMonths = useMemo(() => dataMonthsYm(invoices), [invoices]);
  const filtered = useMemo(() => applyFilters(invoices, filters), [invoices, filters]);
  const rows = useMemo(() => sortList(filtered, sort), [filtered, sort]);
  const stats = useMemo(() => resultStats(rows), [rows]);
  const counts = useMemo(() => typeCounts(invoices, filters), [invoices, filters]);
  const filtersText = describeFilters(filters);
  const range = periodLabel(filters.dateRangeStart, filters.dateRangeEnd) ?? 'All time';
  const ids = useMemo(() => new Set(invoices.map((i) => i.id)), [invoices]);
  const selectedNow = useMemo(() => selected.filter((id) => ids.has(id)), [selected, ids]);
  const byId = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  // The filter bar sticks under the top bar; rows scroll to just below it so keyboard focus is never hidden behind it.
  useEffect(() => {
    const bar = barRef.current;
    const page = pageRef.current;
    if (!bar || !page) return;
    const set_ = () => page.style.setProperty('--inv-sticky', `${bar.offsetHeight}px`);
    set_();
    const ro = new ResizeObserver(set_);
    ro.observe(bar);
    return () => ro.disconnect();
  }, [status, invoices.length]);

  const undoDelete = useCallback(
    async (keyboard = false) => {
      try {
        await undo(keyboard);
        toast.success('Invoice restored');
      } catch {
        toast.error('Couldn’t restore the invoice. Reload to see what is saved.');
      }
    },
    [undo, toast],
  );

  const onDelete = useCallback(
    async (inv: StoredInvoice) => {
      try {
        await remove(inv.id);
        setSelected((s) => s.filter((x) => x !== inv.id));
        toast.info(`Deleted ${inv.invoice.invoiceNumber}`, { action: { label: 'Undo', onClick: () => void undoDelete() } });
      } catch {
        toast.error(`Couldn’t delete ${inv.invoice.invoiceNumber}. It is still in your list.`);
      }
    },
    [remove, toast, undoDelete],
  );

  // Two shortcuts, and only outside text fields and dialogs: "/" jumps to the search, Cmd/Ctrl+Z undoes the last delete.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTextEntry(e.target as HTMLElement)) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && !isTextEntry(e.target as HTMLElement) && canUndo) {
        e.preventDefault();
        void undoDelete(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, undoDelete]);

  const handlers: InvoiceListHandlers = useMemo(
    () => ({
      sort,
      onSort: (f: SortField) => setSort((s) => nextSort(s, f)),
      selected: selectedNow,
      onToggle: (id) => setSelected((s) => toggleSelected(s, id)),
      onOpen: (inv, opener) => {
        openerRef.current = opener ?? openerFromFocus();
        setEditOnOpen(false);
        drawer.open(inv.id);
      },
      onEdit: (inv) => {
        openerRef.current = openerFromFocus();
        setEditOnOpen(true);
        drawer.open(inv.id);
      },
      onDelete: (inv) => void onDelete(inv),
    }),
    [sort, selectedNow, onDelete, drawer],
  );

  // A link to an invoice that is not (or no longer) in the list: say so and drop the parameter instead of showing an empty drawer.
  const openId = drawer.id;
  useEffect(() => {
    if (!openId || status !== 'ready') return;
    if (byId.has(openId)) {
      lastIdRef.current = openId;
      return;
    }
    if (deletedRef.current === openId) return; // deleted from the drawer: it is already closing (a second "back" would leave the page)
    toast.info('That invoice is not in your list any more.');
    drawer.close();
  }, [openId, status, byId, toast, drawer]);
  // the drawer is closed: forget where it came from
  useEffect(() => {
    if (!openId) {
      openerRef.current = null;
      focusAfterRef.current = null;
      deletedRef.current = null;
      setEditOnOpen(false);
    }
  }, [openId]);

  const getReturnFocus = useCallback(() => {
    if (focusAfterRef.current) return rowButtonOf(focusAfterRef.current);
    if (openerRef.current?.isConnected) return openerRef.current;
    return lastIdRef.current ? rowButtonOf(lastIdRef.current) : null;
  }, []);

  if (status === 'error') {
    return (
      <Banner action={<Button variant="secondary" onClick={() => void reload()}>Retry</Button>}>
        Couldn’t load your invoices from the database. Your data is not lost. {error ? <span className="text-ink-muted">({error})</span> : null}
      </Banner>
    );
  }
  if (status === 'loading' && invoices.length === 0) return <Loading />;
  if (invoices.length === 0) {
    return (
      <EmptyState
        icon={FileUp}
        title="No invoices yet"
        action={
          <div className="flex flex-col items-center gap-3">
            <Button variant="primary" size="lg" onClick={() => upload.open()}>Upload PDFs</Button>
            <Button variant="link" href="/data#import-export">Import a JSON backup</Button>
          </div>
        }
      >
        Upload the PDF invoices from your landlord. Rent, parking, water, heating, electricity and waste are picked up automatically.
      </EmptyState>
    );
  }

  const drawerRow = openId ? byId.get(openId) : undefined;
  const rowIds = rows.map((r) => r.id);
  const nav = drawerRow ? neighbours(rowIds, drawerRow.id) : null;
  const pair = selectedNow.map((id) => byId.get(id)).filter((x): x is StoredInvoice => Boolean(x));

  return (
    <div className="inv-page" ref={pageRef}>
      <div className="inv-head no-print">
        <p className="inv-count">{invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'} in total</p>
        <ListExport all={invoices} rows={rows} manualValues={manualValues} filtersText={filtersText} />
      </div>

      <p className="inv-print-only">Invoices: showing {stats.count} of {invoices.length} · {fmtMoney(stats.total)} · Filters: {filtersText}</p>

      <div ref={barRef} className="inv-sticky">
        <FilterBar
          ref={searchRef}
          filters={filters}
          set={set}
          clear={clear}
          counts={counts}
          dataMonths={dataMonths}
          shown={stats.count}
          total={invoices.length}
          sum={stats.total}
          canUndo={canUndo}
          onUndo={() => void undoDelete()}
        />
      </div>

      {selectedNow.length > 0 && (
        <SelectionBar
          count={selectedNow.length}
          onCompare={() => setCompare({ opener: document.activeElement instanceof HTMLElement ? document.activeElement : null })}
          onClear={() => setSelected([])}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No invoices match these filters" action={<Button variant="secondary" onClick={clear}>Clear all filters</Button>}>
          {filtersText === 'none' ? 'Nothing to show.' : `Filters on: ${filtersText}.`}
        </EmptyState>
      ) : (
        <InvoicesPanel rows={rows} h={handlers} range={range} filtersText={filtersText} />
      )}

      {drawerRow && nav && (
        <InvoiceDrawer
          stored={drawerRow}
          nav={nav}
          startInEdit={editOnOpen}
          getReturnFocus={getReturnFocus}
          onClose={drawer.close}
          onPrev={() => nav.prevId && drawer.swap(nav.prevId)}
          onNext={() => nav.nextId && drawer.swap(nav.nextId)}
          onSave={async (next) => {
            try {
              await update(next);
              toast.success('Invoice updated successfully');
            } catch (err) {
              toast.error('Failed to update invoice');
              throw err;
            }
          }}
          onDelete={() => {
            focusAfterRef.current = neighbourAfterRemove(rowIds, drawerRow.id);
            deletedRef.current = drawerRow.id;
            drawer.close();
            void onDelete(drawerRow);
          }}
        />
      )}
      {compare && pair.length === 2 && (
        <CompareDialog
          a={pair[0]}
          b={pair[1]}
          returnFocusTo={compare.opener}
          onClose={() => setCompare(null)}
        />
      )}
    </div>
  );
}
