/**
 * Data → Import JSON: read the file, sort every invoice in it into new / already exists / repeated / unreadable, before anything is written
 * (plan §4.8 item 2). Pure. This is the fix for P21: the old import saved and prepended every row, so importing the same file twice doubled the
 * rows on screen. Here an invoice counts as "already there" when its id OR its invoice number + issue date match, the same duplicate rule uploads use.
 */
import type { StoredInvoice } from './storage';

export interface ImportPlan {
  ok: true;
  /** Rows in the file (including the ones that are skipped). found = fresh + replaceable + repeated + unreadable. */
  found: number;
  /** Not in the list yet: "Import N". */
  fresh: StoredInvoice[];
  /** Already in the list. Each carries the EXISTING row's id, so saving it updates that row instead of adding a second one: "Replace the M existing too". */
  replaceable: StoredInvoice[];
  /** Numbers of the invoices that already exist, in file order (for the preview). */
  existingNumbers: string[];
  /** Same invoice twice inside the file: only the first is used. */
  repeated: number;
  /** Rows that do not look like an invoice. */
  unreadable: number;
}
export type ImportPlanResult = ImportPlan | { ok: false; error: string };

const dupKey = (number: string, date: string) => `${number}-${date}`;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Enough of the invoice shape that every chart, total and export can read it. */
export function looksLikeInvoice(row: unknown): row is { invoice: StoredInvoice['invoice'] } & Record<string, unknown> {
  if (!isObj(row) || !isObj(row.invoice)) return false;
  const inv = row.invoice;
  return (
    typeof inv.invoiceNumber === 'string' && inv.invoiceNumber !== '' &&
    typeof inv.issueDate === 'string' && inv.issueDate !== '' &&
    typeof inv.invoiceType === 'string' &&
    Array.isArray(inv.lineItems) &&
    isObj(inv.totals) && isNum(inv.totals.netTotal) && isNum(inv.totals.taxTotal) && isNum(inv.totals.grossTotal)
  );
}

/**
 * `makeId` gives an id to a row that has none (the app passes storage.generateId). `now` stamps a missing parsedAt.
 * Never throws: a file that is not JSON, or not a list, comes back as { ok: false, error }.
 */
export function planImport(json: string, existing: StoredInvoice[], makeId: () => string, now: () => string = () => new Date().toISOString()): ImportPlanResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (err) {
    return { ok: false, error: `This file is not valid JSON (${err instanceof Error ? err.message : 'unreadable'}).` };
  }
  if (!Array.isArray(data)) return { ok: false, error: 'Expected a list of invoices, the way Export → JSON writes it.' };

  const byId = new Map(existing.map((e) => [e.id, e]));
  const byKey = new Map(existing.map((e) => [dupKey(e.invoice.invoiceNumber, e.invoice.issueDate), e]));
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const plan: ImportPlan = { ok: true, found: data.length, fresh: [], replaceable: [], existingNumbers: [], repeated: 0, unreadable: 0 };

  for (const row of data) {
    if (!looksLikeInvoice(row)) {
      plan.unreadable++;
      continue;
    }
    const key = dupKey(row.invoice.invoiceNumber, row.invoice.issueDate);
    const rawId = typeof row.id === 'string' && row.id !== '' ? row.id : null;
    if ((rawId && seenIds.has(rawId)) || seenKeys.has(key)) {
      plan.repeated++;
      continue;
    }
    const match = (rawId ? byId.get(rawId) : undefined) ?? byKey.get(key);
    const filename = typeof row.filename === 'string' ? row.filename : '';
    const parsedAt = typeof row.parsedAt === 'string' && row.parsedAt !== '' ? row.parsedAt : now();
    if (rawId) seenIds.add(rawId);
    seenKeys.add(key);
    if (match) {
      plan.existingNumbers.push(row.invoice.invoiceNumber);
      plan.replaceable.push({ id: match.id, filename: filename || match.filename, parsedAt, invoice: row.invoice });
    } else {
      plan.fresh.push({ id: rawId ?? makeId(), filename, parsedAt, invoice: row.invoice });
    }
  }
  return plan;
}

/** "26 invoices found · 3 already exist · 23 new" */
export function describePlan(p: ImportPlan): string {
  const n = (c: number, one: string, many = `${one}s`) => `${c} ${c === 1 ? one : many}`;
  return `${n(p.found, 'invoice')} found · ${p.replaceable.length} already ${p.replaceable.length === 1 ? 'exists' : 'exist'} · ${p.fresh.length} new`;
}
