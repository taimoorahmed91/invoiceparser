'use client';

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { Uploader, summarize, type UploadItem, type UploadSummary } from '@/lib/uploader';
import { parseViaApi } from '@/lib/uploadApi';
import { generateId } from '@/lib/storage';

const NONE: readonly UploadItem[] = [];

/**
 * The upload queue as a hook (plan §4.6): one Uploader per mount, wired to the invoice provider.
 * Reading goes to /api/parse one file at a time; saving is `addMany([row])`, i.e. the same `addInvoice` call the old page made.
 * Duplicate checks wait until the stored list is known (and fail with a reason if it could not be loaded).
 */
export function useUploader(): {
  items: readonly UploadItem[];
  summary: UploadSummary;
  add: (files: File[]) => number;
  retry: (id?: string) => number;
  clear: () => void;
  isWorking: () => boolean;
} {
  const { invoices, status, addMany } = useInvoices();
  const latest = useRef({ invoices, status, addMany });
  latest.current = { invoices, status, addMany };
  // callers waiting for the invoice list to finish loading
  const waiting = useRef<Array<() => void>>([]);
  useEffect(() => {
    if (status !== 'loading') {
      waiting.current.forEach((w) => w());
      waiting.current = [];
    }
  }, [status]);

  const uploader = useMemo(
    () =>
      new Uploader({
        parse: (file) => parseViaApi(file),
        stored: () => latest.current.invoices,
        save: (row) => latest.current.addMany([row]),
        newId: generateId,
        ready: async () => {
          if (latest.current.status === 'loading') await new Promise<void>((resolve) => waiting.current.push(resolve));
          if (latest.current.status === 'error') throw new Error('Your invoice list could not be loaded, so duplicates can’t be checked. Reload the page and retry.');
        },
      }),
    [],
  );

  const items = useSyncExternalStore(uploader.subscribe, uploader.getSnapshot, () => NONE);
  const summary = useMemo(() => summarize(items), [items]);
  const add = useCallback((files: File[]) => uploader.add(files), [uploader]);
  const retry = useCallback((id?: string) => uploader.retry(id), [uploader]);
  const clear = useCallback(() => uploader.clear(), [uploader]);
  const isWorking = useCallback(() => uploader.isWorking(), [uploader]);
  return { items, summary, add, retry, clear, isWorking };
}
