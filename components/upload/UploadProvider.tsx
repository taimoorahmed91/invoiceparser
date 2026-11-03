'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useToast } from '@/components/toast/ToastProvider';
import { useInvoices } from '@/hooks/useInvoices';
import { useUploader } from '@/hooks/useUploader';
import { failureMessage, summaryText } from '@/lib/uploader';
import { DropOverlay } from './DropOverlay';
import { UploadDialog } from './UploadDialog';

interface UploadApi {
  /** Opens the upload dialog; with files, adds them to the queue right away (drop, or a picker elsewhere). */
  open: (files?: File[]) => void;
  isOpen: boolean;
}

const UploadContext = createContext<UploadApi | null>(null);

export function useUpload(): UploadApi {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used inside <UploadProvider>');
  return ctx;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * The one Upload dialog for the whole app (plan §4.6): opened from the top bar and the empty states, and by dropping files anywhere on a page.
 * The queue lives here, not in the dialog, so closing the dialog never loses work: files keep being read and saved, and a toast says how it went.
 */
export function UploadProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { invoices } = useInvoices();
  const { items, summary, add, retry, clear, isWorking } = useUploader();
  const [isOpen, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  openRef.current = isOpen;
  const failedRef = useRef(0);
  failedRef.current = summary.failed;

  const invoicesById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  const show = useCallback(
    (files?: File[]) => {
      if (files && files.length) add(files);
      else if (!isWorking() && failedRef.current === 0) clear(); // a clean slate, unless there is something to retry
      if (!openRef.current) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    },
    [add, clear, isWorking],
  );

  /** What is told to the user once the work is finished and the dialog is not showing it: failures stay until dismissed, with a way back. */
  const report = useCallback(
    (alsoSuccess: boolean) => {
      const failed = failureMessage(items);
      if (failed) toast.error(failed, { action: { label: 'Upload again', onClick: () => show() } });
      else if (alsoSuccess && summary.saved + summary.duplicates > 0) toast.success(`Upload finished: ${summaryText(summary)}`);
    },
    [items, summary, toast, show],
  );

  const close = useCallback(() => {
    setOpen(false);
    // still working: say nothing now, the toast comes when the last file is done
    if (!isWorking()) report(false);
  }, [isWorking, report]);

  // finished while the dialog was closed
  const wasWorking = useRef(false);
  useEffect(() => {
    if (summary.working > 0) wasWorking.current = true;
    else if (wasWorking.current && summary.done) {
      wasWorking.current = false;
      if (!openRef.current) report(true);
    }
  }, [summary.working, summary.done, report]);

  // drop anywhere: the window takes the drop, whichever page is showing
  useEffect(() => {
    // Browsers hide dataTransfer.types on dragleave, so "this is a file drag" is remembered from dragenter.
    let depth = 0;
    let fileDrag = false;
    // A live drag keeps sending dragover every few hundred ms. If they stop (drag cancelled with Esc, left the window, tab switched)
    // and no dragleave arrived, the overlay must not stay on screen.
    let idle: ReturnType<typeof setTimeout> | undefined;
    const IDLE_MS = 1200;
    const stillDragging = () => {
      clearTimeout(idle);
      idle = setTimeout(reset, IDLE_MS);
    };
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      fileDrag = true;
      depth++;
      setDragging(true);
      stillDragging();
    };
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // without this the browser refuses the drop and would open the PDF instead
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      if (fileDrag) stillDragging();
    };
    const onLeave = (e: DragEvent) => {
      if (!fileDrag) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0 || e.relatedTarget === null) reset();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) show(files);
    };
    function reset() {
      clearTimeout(idle);
      depth = 0;
      fileDrag = false;
      setDragging(false);
    }
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragover', onOver);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    window.addEventListener('blur', reset);
    return () => {
      clearTimeout(idle);
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('blur', reset);
    };
  }, [show]);

  const api = useMemo<UploadApi>(() => ({ open: show, isOpen }), [show, isOpen]);

  return (
    <UploadContext.Provider value={api}>
      {children}
      {dragging && !isOpen && <DropOverlay />}
      {isOpen && (
        <UploadDialog
          items={items}
          summary={summary}
          dragging={dragging}
          stored={(id) => invoicesById.get(id)}
          onPick={add}
          onRetry={(id) => retry(id)}
          onRetryFailed={() => retry()}
          onClose={close}
          returnFocusTo={opener.current}
        />
      )}
    </UploadContext.Provider>
  );
}
