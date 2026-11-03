'use client';

import { Download, FileText, Image as ImageIcon, Table2 } from 'lucide-react';
import { MenuButton, type MenuEntry } from '@/components/ui/MenuButton';
import type { ViewMode } from '@/lib/dataView';

export interface ExportHandlers {
  png: () => void;
  csv: () => void;
  pdf: () => void;
}

/**
 * Items of the Export menu (plan §4.11.4):
 *   Chart view → PNG (image) · CSV (chart data) · PDF (chart page)
 *   Table view → CSV (table) · PDF (table page)
 * Every item is text, and is unavailable with a reason when there is nothing to export.
 */
export function buildExportEntries(opts: { view: ViewMode; empty: boolean; busy: boolean; handlers: ExportHandlers }): MenuEntry[] {
  const { view, empty, busy, handlers } = opts;
  const reason = empty ? 'Nothing to export yet' : busy ? 'Another export is running' : undefined;
  const entries: MenuEntry[] = [];
  if (view === 'chart') entries.push({ label: 'PNG (image)', icon: ImageIcon, disabledReason: reason, onSelect: handlers.png });
  entries.push({ label: view === 'chart' ? 'CSV (chart data)' : 'CSV (table)', icon: Table2, disabledReason: reason, onSelect: handlers.csv });
  entries.push({ label: view === 'chart' ? 'PDF (chart page)' : 'PDF (table page)', icon: FileText, description: 'Opens the print dialog: choose “Save as PDF”', disabledReason: reason, onSelect: handlers.pdf });
  return entries;
}

export function ExportMenu({ entries, size = 'sm' }: { entries: MenuEntry[]; size?: 'sm' | 'md' }) {
  return <MenuButton label="Export" icon={Download} size={size} align="end" entries={entries} />;
}
