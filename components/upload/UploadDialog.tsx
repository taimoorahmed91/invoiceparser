'use client';

import { useEffect, useRef, type DragEvent } from 'react';
import { CloudUpload, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/overlay/Dialog';
import { liveMessage, summaryText, type UploadItem, type UploadSummary } from '@/lib/uploader';
import type { StoredInvoice } from '@/lib/storage';
import { UploadRow } from './UploadRow';

/**
 * Upload invoices (plan §4.6): drop zone that is also a real "Choose PDFs" button, one row per file with an icon and a text status,
 * a summary line that is announced when the work is done, Retry failed and Done.
 */
export function UploadDialog({
  items, summary, dragging, stored, onPick, onRetry, onRetryFailed, onClose, returnFocusTo,
}: {
  items: readonly UploadItem[];
  summary: UploadSummary;
  /** A file drag is over the window right now (the zone lights up). */
  dragging: boolean;
  /** Finds the invoice already in the list for a duplicate row. */
  stored: (id: string) => StoredInvoice | undefined;
  onPick: (files: File[]) => void;
  onRetry: (id: string) => void;
  onRetryFailed: () => void;
  onClose: () => void;
  returnFocusTo: HTMLElement | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const hasRows = items.length > 0;

  // When everything finished and nothing failed, the next thing you want is Done: focus moves there (and the summary is announced).
  const wasWorking = useRef(false);
  useEffect(() => {
    if (summary.working > 0) wasWorking.current = true;
    else if (wasWorking.current && summary.done) {
      wasWorking.current = false;
      if (summary.failed === 0) done.current?.focus();
    }
  }, [summary.working, summary.done, summary.failed]);

  const finished = summary.total - summary.working;
  const onDragOver = (e: DragEvent) => e.preventDefault(); // the window handler does the work; this only keeps the cursor friendly

  return (
    <Dialog
      wide
      closeButton
      title="Upload invoices"
      returnFocusTo={returnFocusTo}
      onClose={onClose}
      actions={
        <div className="up-footer" style={{ width: '100%' }}>
          {hasRows && (
            <p className="up-summary">
              {summary.working > 0 ? `${finished} of ${summary.total} done` : summaryText(summary)}
            </p>
          )}
          <div className="dlg-actions" style={{ marginTop: 0 }}>
            {summary.failed > 0 && (
              <Button variant="secondary" onClick={onRetryFailed}>
                {`Retry failed (${summary.failed})`}
              </Button>
            )}
            <Button ref={done} variant="primary" onClick={onClose}>Done</Button>
          </div>
        </div>
      }
    >
      <div className="up-body">
        <div className="up-zone" data-dragging={dragging ? 'true' : undefined} data-compact={hasRows ? 'true' : undefined} onDragOver={onDragOver}>
          <CloudUpload size={32} strokeWidth={1.5} aria-hidden="true" className="up-zone-icon" />
          <div className="up-zone-text">
            <p className="up-zone-title">{dragging ? 'Release to add' : hasRows ? 'Drop more PDFs here' : 'Drop PDF invoices here'}</p>
            <p className="up-zone-sub">PDF only · you can pick several at once</p>
          </div>
          <input
            ref={input}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            data-upload
            className="sr-only-text"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = ''; // the same file can be picked again
              if (files.length) onPick(files);
            }}
          />
          <Button data-autofocus variant={hasRows ? 'secondary' : 'primary'} icon={FileUp} onClick={() => input.current?.click()}>
            Choose PDFs
          </Button>
        </div>

        {hasRows && (
          <>
            <p className="up-count">{items.length} {items.length === 1 ? 'file' : 'files'}</p>
            <ul className="up-list" aria-label="Files">
              {items.map((item) => (
                <UploadRow key={item.id} item={item} stored={item.duplicateOf?.id ? stored(item.duplicateOf.id) : undefined} onRetry={onRetry} onNavigate={onClose} />
              ))}
            </ul>
          </>
        )}
        {/* announced politely: quiet while working, the full summary when every file is done */}
        <p className="sr-only-text" role="status" aria-live="polite" aria-atomic="true">{liveMessage(items)}</p>
      </div>
    </Dialog>
  );
}
