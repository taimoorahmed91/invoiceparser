'use client';

import { useMemo } from 'react';
import fixture from '@/tests/fixtures/invoices.json';
import { monthlyTotals } from '@/lib/analytics';
import { fmtMoney, fmtQuantity } from '@/lib/format';
import type { StoredInvoice } from '@/lib/storage';
import type { TableSpec, TimeSeriesSpec } from '@/lib/dataView';
import { ChartCard } from '@/components/charts/ChartCard';
import { DataPanel } from '@/components/charts/DataPanel';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';

/**
 * THROWAWAY (plan §7 Phase 3.5): demo panels built from the Phase 0 fixture so the shared toolbar can be
 * tested before any real chart exists. Deleted once Phase 4a ships the real Analytics ChartCards.
 */
export function DataViewDemo() {
  const { all, three, polish, lineItems } = useMemo(() => {
    const rows = monthlyTotals(fixture as unknown as StoredInvoice[]);
    const base = (r: typeof rows): TimeSeriesSpec => ({
      xKey: 'month',
      xLabel: 'Month',
      rows: r,
      series: [
        { key: 'Rent', label: 'Rent', color: 'var(--rent)' },
        { key: 'Parking', label: 'Parking', color: 'var(--parking)' },
        { key: 'Utility', label: 'Utility', color: 'var(--utility)' },
      ],
      allowArea: true,
      showTotal: true,
      formatValue: (n) => fmtMoney(n),
    });
    const all = base(rows);
    const three = base(rows.slice(0, 3));
    const polish: TimeSeriesSpec = {
      xKey: 'month',
      xLabel: 'Miesiąc',
      allowArea: true,
      showTotal: true,
      formatValue: (n) => fmtMoney(n),
      series: [
        { key: 'ch', label: 'Centralne ogrzewanie', color: 'var(--central-heating)' },
        { key: 'cw', label: 'Zimna woda', color: 'var(--cold-water)' },
        { key: 'go', label: 'Gospodarka odpadami', color: 'var(--waste)' },
        { key: 'ee', label: 'Energia elektryczna', color: 'var(--electricity)' },
      ],
      rows: rows.filter((r) => r.Utility > 0).map((r) => ({
        month: r.month,
        ch: Math.round(r.Utility * 0.45 * 100) / 100,
        cw: Math.round(r.Utility * 0.2 * 100) / 100,
        go: Math.round(r.Utility * 0.15 * 100) / 100,
        ee: Math.round(r.Utility * 0.2 * 100) / 100,
      })),
    };
    const lineItems: TableSpec = {
      columns: [
        { key: 'desc', label: 'Opis' },
        { key: 'qty', label: 'Ilość', align: 'right', format: (v) => fmtQuantity(Number(v), 'GJ') },
        { key: 'gross', label: 'Brutto', align: 'right', format: (v) => fmtMoney(Number(v)) },
      ],
      rows: [
        { desc: 'Centralne ogrzewanie', qty: 1.82, gross: 412.3 },
        { desc: 'Zimna woda i ścieki', qty: 6.4, gross: 128.55 },
        { desc: 'Gospodarka odpadami', qty: 1, gross: 76 },
        { desc: 'Energia elektryczna — żółć, źdźbło, ząb, święty, mąka', qty: 220, gross: 301.2 },
        { desc: 'Łódź, Gdańsk, Kraków, Poznań, Wrocław', qty: 1, gross: 0 },
      ],
    };
    return { all, three, polish, lineItems };
  }, []);

  const monthlyTable: TableSpec = useMemo(
    () => ({
      columns: [
        { key: 'month', label: 'Month' },
        { key: 'Rent', label: 'Rent', align: 'right', format: (v) => fmtMoney(Number(v)) },
        { key: 'Utility', label: 'Utility', align: 'right', format: (v) => fmtMoney(Number(v)) },
      ],
      rows: all.rows,
    }),
    [all],
  );

  return (
    <div className="min-h-screen bg-canvas text-ink p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[26px] leading-8 font-semibold">Data view demo (Phase 3.5, throwaway)</h1>
          <p className="text-ink-muted text-[14px] max-w-prose">
            Shared toolbar on every chart and table: Chart | Table, Bar | Line | Area (needs 4 points), Full screen, Export (PNG, CSV, PDF).
            Choices are remembered per panel. Removed once Phase 4a ships the real charts.
          </p>
        </div>
        <ThemeSwitch size="md" />
      </header>
      <div className="grid gap-6 max-w-[1200px] mx-auto">
        <ChartCard
          spec={all}
          title="Monthly costs"
          subtitle="All fixture months, stacked by type"
          storageKey="demo.monthly-costs"
          range={`${String(all.rows[0]?.month)} – ${String(all.rows[all.rows.length - 1]?.month)}`}
          filters="none"
        />
        <ChartCard spec={three} title="Monthly costs, first 3 months" subtitle="Only 3 points: Line and Area say why they are unavailable" storageKey="demo.truncated" />
        <ChartCard spec={polish} title="Opłaty za media — Centralne ogrzewanie" subtitle="Polish labels: ł ą ś ć ę ż ź ń ó" storageKey="demo.utilities-pl" range="Nov 2025 – Nov 2026" filters="Utility" />
        <DataPanel table={lineItems} title="Pozycje faktury (Central Heating, Cold Water, Waste)" subtitle="A table with no time series: Chart is visible but unavailable" storageKey="demo.line-items" headingLevel={2} />
        <DataPanel
          table={monthlyTable}
          chartSpec={all}
          title="Monthly totals (table first)"
          subtitle="A table whose numbers form a time series: Chart works"
          storageKey="demo.table-with-chart"
        />
      </div>
    </div>
  );
}
