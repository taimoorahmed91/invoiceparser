/**
 * The upload queue (plan §4.6), without React. Every file becomes a row; rows move
 *   waiting → reading → saving → saved | duplicate | failed        (a non-PDF is "skipped" at once)
 * Files are read two at a time. Saving to the database is one at a time, in the order the files finished reading, exactly like the old
 * handler (`addInvoice` per invoice). A duplicate is decided by the existing key, invoiceNumber + issueDate (never changed), against the
 * stored invoices and against EARLIER files of the same batch: decisions are made in file order even though reading overlaps,
 * so "earlier file" is deterministic. Retry only touches failed rows. The UI listens through subscribe().
 */
import { parseWarnings, type ParseWarning } from './parseWarnings';
import { isPdfFile, type ParseOutcome } from './uploadApi';
import type { ParsedInvoice } from './parseInvoice';
import type { StoredInvoice } from './storage';

export type UploadStatus = 'waiting' | 'reading' | 'saving' | 'saved' | 'duplicate' | 'failed' | 'skipped';

export interface DuplicateInfo {
  /** The invoice already in the list (null when the earlier copy is another file of this batch that is still being saved). */
  id: string | null;
  invoiceNumber: string;
  issueDate: string;
  where: 'saved' | 'batch';
  /** The earlier file of this batch, when where = 'batch'. */
  fileName?: string;
}

export interface UploadItem {
  id: string;
  seq: number;
  name: string;
  status: UploadStatus;
  /** Which step failed: the server could not read the file, or the database refused the save. */
  stage?: 'read' | 'save';
  /** The technical reason, shown behind "Details". */
  error?: string;
  invoice?: ParsedInvoice;
  /** The row that is (or was) written; kept so a failed save is retried with the same id, not read again. */
  row?: StoredInvoice;
  warnings: ParseWarning[];
  duplicateOf?: DuplicateInfo;
}

export interface UploaderDeps {
  /** Read one file (see lib/uploadApi.ts). The File itself is kept by the uploader, not by the row. */
  parse(file: File): Promise<ParseOutcome>;
  /** The invoices stored right now (read again for every decision). */
  stored(): StoredInvoice[];
  /**
   * Resolves once the stored list is known. Rejects when it could not be loaded: then duplicates can not be checked, and saving anyway
   * could create them, so the row fails instead (with the reason) and can be retried.
   */
  ready?(): Promise<void>;
  /** Write one invoice: addInvoice + add it to the list. Rejects when the database refuses. */
  save(row: StoredInvoice): Promise<void>;
  newId(): string;
  now?(): string;
  concurrency?: number;
}

export const dupKey = (invoice: Pick<ParsedInvoice, 'invoiceNumber' | 'issueDate'>) => `${invoice.invoiceNumber}-${invoice.issueDate}`;

const message = (err: unknown) => (err instanceof Error && err.message ? err.message : String(err));

export class Uploader {
  private items: UploadItem[] = [];
  private files = new Map<string, File>();
  private listeners = new Set<() => void>();
  private waiters: Array<{ pred: () => boolean; resolve: () => void }> = [];
  /** key → id of the item of this batch that holds it (saving or saved). */
  private claims = new Map<string, string>();
  private active = 0;
  private counter = 0;
  private saveChain: Promise<unknown> = Promise.resolve();
  private readonly concurrency: number;

  constructor(private readonly deps: UploaderDeps) {
    this.concurrency = deps.concurrency ?? 2;
  }

  /* ----- store interface (useSyncExternalStore) ----- */
  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getSnapshot = (): readonly UploadItem[] => this.items;

  private set(next: UploadItem[]) {
    this.items = next;
    this.listeners.forEach((l) => l());
    this.waiters = this.waiters.filter((w) => {
      if (!w.pred()) return true;
      w.resolve();
      return false;
    });
  }
  private patch(id: string, change: Partial<UploadItem>) {
    this.set(this.items.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }
  private until(pred: () => boolean): Promise<void> {
    if (pred()) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push({ pred, resolve }));
  }

  /* ----- commands ----- */
  /** True while anything is waiting, being read or being saved. */
  isWorking(): boolean {
    return this.items.some((i) => i.status === 'waiting' || i.status === 'reading' || i.status === 'saving');
  }

  /**
   * Add files. While a batch is running they join it; when nothing is running a new batch starts (the previous rows are cleared).
   * Anything that is not a PDF is listed as skipped instead of silently disappearing.
   */
  add(files: File[]): number {
    if (files.length === 0) return 0;
    const fresh = this.isWorking() ? this.items : [];
    if (fresh.length === 0) {
      this.claims.clear();
      this.files.clear();
    }
    const added: UploadItem[] = files.map((file) => {
      const id = `u${++this.counter}`;
      this.files.set(id, file);
      const pdf = isPdfFile(file);
      return { id, seq: this.counter, name: file.name, status: pdf ? 'waiting' : 'skipped', warnings: [] };
    });
    this.set([...fresh, ...added]);
    this.pump();
    return added.length;
  }

  /** Try again: one row (by id) or every failed row. Nothing else is sent. */
  retry(id?: string): number {
    const targets = this.items.filter((i) => i.status === 'failed' && (id === undefined || i.id === id));
    if (targets.length === 0) return 0;
    const ids = new Set(targets.map((t) => t.id));
    this.set(this.items.map((i) => (ids.has(i.id) ? { ...i, status: 'waiting' as const, error: undefined, stage: undefined } : i)));
    this.pump();
    return targets.length;
  }

  clear() {
    if (this.isWorking()) return;
    this.claims.clear();
    this.files.clear();
    this.set([]);
  }

  /* ----- the work ----- */
  private pump() {
    while (this.active < this.concurrency) {
      const next = this.items.find((i) => i.status === 'waiting');
      if (!next) return;
      this.active++;
      // mark it right away so the next loop does not pick it again
      this.patch(next.id, { status: next.row ? 'saving' : 'reading' });
      void this.run(next.id).finally(() => {
        this.active--;
        this.pump();
      });
    }
  }

  private get(id: string): UploadItem {
    return this.items.find((i) => i.id === id)!;
  }

  private fail(id: string, stage: 'read' | 'save', error: string) {
    this.patch(id, { status: 'failed', stage, error });
  }

  private async run(id: string) {
    const item = this.get(id);
    try {
      // a failed save is retried with the invoice already read, without reading the file again
      if (item.row && item.invoice) {
        await this.decideAndSave(id, item.invoice, item.row);
        return;
      }
      const file = this.files.get(id);
      if (!file) return this.fail(id, 'read', 'The file is no longer available.');
      let outcome: ParseOutcome;
      try {
        outcome = await this.deps.parse(file);
      } catch (err) {
        outcome = { ok: false, error: message(err) };
      }
      if (!outcome.ok) return this.fail(id, 'read', outcome.error);
      // Decisions follow file order: wait while an earlier file is still being read.
      const seq = this.get(id).seq;
      await this.until(() => !this.items.some((i) => i.seq < seq && i.status === 'reading'));
      await this.decideAndSave(id, outcome.invoice);
    } catch (err) {
      this.fail(id, this.get(id)?.row ? 'save' : 'read', message(err));
    }
  }

  private async decideAndSave(id: string, invoice: ParsedInvoice, existingRow?: StoredInvoice) {
    try {
      await this.deps.ready?.();
    } catch (err) {
      this.patch(id, { invoice });
      return this.fail(id, 'save', message(err));
    }
    const key = dupKey(invoice);
    const stored = this.deps.stored().find((s) => dupKey(s.invoice) === key && s.id !== existingRow?.id);
    if (stored) {
      this.patch(id, { status: 'duplicate', invoice, duplicateOf: { id: stored.id, invoiceNumber: stored.invoice.invoiceNumber, issueDate: stored.invoice.issueDate, where: 'saved' } });
      return;
    }
    const owner = this.claims.get(key);
    if (owner && owner !== id) {
      const other = this.get(owner);
      this.patch(id, { status: 'duplicate', invoice, duplicateOf: { id: null, invoiceNumber: invoice.invoiceNumber, issueDate: invoice.issueDate, where: 'batch', fileName: other?.name } });
      return;
    }
    this.claims.set(key, id);
    const row: StoredInvoice = existingRow ?? { id: this.deps.newId(), filename: this.get(id).name, parsedAt: (this.deps.now ?? (() => new Date().toISOString()))(), invoice };
    this.patch(id, { status: 'saving', invoice, row, warnings: parseWarnings(invoice) });
    // one write at a time, in the order the files finished reading
    const write = this.saveChain.then(() => this.deps.save(row));
    this.saveChain = write.catch(() => undefined);
    try {
      await write;
      this.patch(id, { status: 'saved' });
    } catch (err) {
      if (this.claims.get(key) === id) this.claims.delete(key);
      this.fail(id, 'save', message(err));
    }
  }
}

/* ---------- summary and messages (pure) ---------- */

export interface UploadSummary {
  total: number;
  saved: number;
  /** Saved rows that raised a parse warning ("check this one"). */
  needCheck: number;
  duplicates: number;
  failed: number;
  skipped: number;
  /** waiting + reading + saving */
  working: number;
  done: boolean;
}

export function summarize(items: readonly UploadItem[]): UploadSummary {
  const count = (s: UploadStatus) => items.filter((i) => i.status === s).length;
  const working = count('waiting') + count('reading') + count('saving');
  return {
    total: items.length,
    saved: count('saved'),
    needCheck: items.filter((i) => i.status === 'saved' && i.warnings.length > 0).length,
    duplicates: count('duplicate'),
    failed: count('failed'),
    skipped: count('skipped'),
    working,
    done: items.length > 0 && working === 0,
  };
}

/** "2 saved (1 to check) · 1 already saved · 1 failed · 1 skipped" (zero counts are left out). */
export function summaryText(s: UploadSummary): string {
  const parts: string[] = [];
  if (s.saved) parts.push(`${s.saved} saved${s.needCheck ? ` (${s.needCheck} to check)` : ''}`);
  if (s.duplicates) parts.push(`${s.duplicates} already saved`);
  if (s.failed) parts.push(`${s.failed} failed`);
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  return parts.join(' · ') || 'Nothing was saved';
}

const names = (list: string[]) => (list.length <= 3 ? list.join(', ') : `${list.slice(0, 3).join(', ')} and ${list.length - 3} more`);

/** The persistent error toast shown when the dialog closes with failures left: "1 file couldn't be read: broken.pdf". null when none failed. */
export function failureMessage(items: readonly UploadItem[]): string | null {
  const failed = items.filter((i) => i.status === 'failed');
  if (failed.length === 0) return null;
  const read = failed.filter((i) => i.stage !== 'save').map((i) => i.name);
  const save = failed.filter((i) => i.stage === 'save').map((i) => i.name);
  const files = (n: number) => `${n} ${n === 1 ? 'file' : 'files'}`;
  if (save.length === 0) return `${files(read.length)} couldn’t be read: ${names(read)}`;
  if (read.length === 0) return `${files(save.length)} couldn’t be saved: ${names(save)}`;
  return `${files(failed.length)} failed: ${names(failed.map((f) => f.name))}`;
}

/** What the live region says: nothing while files are being worked on, the full summary when they are all done. */
export function liveMessage(items: readonly UploadItem[]): string {
  const s = summarize(items);
  if (s.total === 0) return '';
  if (!s.done) return `Working on ${s.total} ${s.total === 1 ? 'file' : 'files'}`;
  return `Upload finished: ${summaryText(s)}`;
}
