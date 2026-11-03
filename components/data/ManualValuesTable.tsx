'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Flame } from 'lucide-react';
import { DataPanel } from '@/components/charts/DataPanel';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/toast/ToastProvider';
import { useUpload } from '@/components/upload/UploadProvider';
import { useInvoices } from '@/hooks/useInvoices';
import { useManualValues } from '@/hooks/useManualValues';
import { HEATING_RATE } from '@/lib/adjustments';
import { buildManualRows, formatUnits, manualChartSpec, manualStatus, manualTableSpec, parseUnits, type ManualRow } from '@/lib/dataManual';
import type { DataRow, TableColumn } from '@/lib/dataView';

type RowState = 'saving' | 'failed';

/**
 * The Units box of one month. Enter or leaving the box saves, Esc puts the saved value back (plan §4.8 item 1).
 * A typo is an inline error and nothing is saved; the old editor turned it into 0.
 */
function UnitsInput({ row, onSave }: { row: ManualRow; onSave: (month: string, units: number) => Promise<void> }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const commit = () => {
    if (draft === null) return;
    const parsed = parseUnits(draft);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(undefined);
    setDraft(null);
    if (parsed.value !== row.units) void onSave(row.month, parsed.value).catch(() => undefined);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape' && draft !== null) {
      e.preventDefault();
      e.stopPropagation(); // do not also close a full screen around the table
      setDraft(null);
      setError(undefined);
    }
  };

  return (
    <div className="dt-units">
      <Input
        numeric
        size="md"
        aria-label={`Heating units for ${row.month}`}
        placeholder="0"
        value={draft ?? formatUnits(row.units)}
        error={error}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(undefined);
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

function StatusCell({ row, state }: { row: ManualRow; state?: RowState }) {
  if (state === 'saving') return <span className="dt-state" role="status">Saving…</span>;
  if (state === 'failed') {
    return (
      <span className="dt-state" data-state="failed" role="status">
        <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
        Not saved yet
      </span>
    );
  }
  if (row.units > 0) {
    return (
      <span className="dt-state" data-state="saved">
        <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />
        {row.hasInvoice ? 'Saved' : manualStatus(row)}
      </span>
    );
  }
  return <span className="dt-state">Not set</span>;
}

/** Data → Manual heating values: a DataPanel (Chart | Table, Expand, Export CSV / PDF) with an editable Units column. */
export function ManualValuesTable() {
  const { invoices } = useInvoices();
  const manual = useManualValues();
  const toast = useToast();
  const upload = useUpload();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  // Each save rewrites the whole manual-values table (as the old editor did), so two quick edits must not overlap.
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const rows = useMemo(() => buildManualRows(invoices, manual.values), [invoices, manual.values]);
  const byMonth = useMemo(() => new Map(rows.map((r) => [r.month, r])), [rows]);
  const table = useMemo(() => manualTableSpec(rows), [rows]);
  const chart = useMemo(() => manualChartSpec(rows), [rows]);

  const save = useCallback(
    (month: string, units: number) => {
      setRowStates((s) => ({ ...s, [month]: 'saving' }));
      const run = queue.current.then(() => manual.setValue(month, units));
      queue.current = run.catch(() => undefined);
      return run.then(
        () => setRowStates((s) => {
          const { [month]: _done, ...rest } = s;
          return rest;
        }),
        (error: unknown) => {
          setRowStates((s) => ({ ...s, [month]: 'failed' }));
          toast.error(`Couldn’t save the heating value for ${month}. Check your connection, then use “Save manual values now” under Sync.`);
          throw error;
        },
      );
    },
    [manual, toast],
  );

  const renderCell = useCallback(
    (column: TableColumn, dataRow: DataRow): ReactNode | undefined => {
      const row = byMonth.get(String(dataRow.month));
      if (!row) return undefined;
      if (column.key === 'units') return <UnitsInput key={row.month} row={row} onSave={save} />;
      if (column.key === 'status') return <StatusCell row={row} state={rowStates[row.month]} />;
      return undefined;
    },
    [byMonth, rowStates, save],
  );

  if (manual.status === 'error') {
    return (
      <Banner action={<Button variant="secondary" onClick={() => void manual.reload()}>Retry</Button>}>
        Couldn’t load your manual heating values. Your data is not lost.
      </Banner>
    );
  }
  if (manual.status === 'loading' && rows.length === 0) return <Skeleton height={320} label="Loading manual heating values" />;
  if (rows.length === 0) {
    return (
      <div className="dt-card">
        <h2 className="dt-title">Manual heating values</h2>
        <EmptyState icon={Flame} title="No Utility invoices yet" action={<Button variant="secondary" onClick={() => upload.open()}>Upload PDFs</Button>}>
          Manual heating values belong to the month of a Utility invoice. Upload one first.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <DataPanel
        title="Manual heating values"
        subtitle={`Units per month · Rate: ${HEATING_RATE} zł per unit`}
        storageKey="data.manual-heating"
        table={table}
        chartSpec={chart}
        renderCell={renderCell}
        chartHeight={300}
        tableMaxHeight={480}
        range="All months with a Utility invoice"
        filters="none"
      />
      <p className="dt-hint">
        Press Enter or leave the box to save; Esc undoes your change. Each unit is {HEATING_RATE} zł that moves from Central Heating to a
        “Manual Heating Calculation” line on that month’s Utility invoice.
      </p>
    </>
  );
}
