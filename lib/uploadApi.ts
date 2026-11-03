/**
 * Talks to /api/parse for ONE file at a time (plan §4.6: one request per file, so every row has a real state).
 * The route reads every entry of the `files` field, so a single-file request is the same call as before with a list of one.
 * Pure of React; `fetch` and the timeout can be replaced in tests.
 */
import type { ParsedInvoice } from './parseInvoice';

export type ParseOutcome = { ok: true; invoice: ParsedInvoice } | { ok: false; error: string };

const PDF_TYPES = new Set(['application/pdf', 'application/x-pdf']);

/** A PDF by its type, or by its name when the system gave no type (some drag-and-drop sources do that). */
export function isPdfFile(file: { name: string; type: string }): boolean {
  if (PDF_TYPES.has(file.type)) return true;
  return file.type === '' && /\.pdf$/i.test(file.name);
}

export const PARSE_TIMEOUT_MS = 60_000;

export async function parseViaApi(file: File, opts: { fetch?: typeof fetch; timeoutMs?: number } = {}): Promise<ParseOutcome> {
  const send = opts.fetch ?? fetch;
  // The route refuses anything whose type is not application/pdf, so a PDF without a type is re-wrapped with the right one.
  const upload = file.type === 'application/pdf' ? file : new File([file], file.name, { type: 'application/pdf' });
  const form = new FormData();
  form.append('files', upload);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? PARSE_TIMEOUT_MS);
  let response: Response;
  try {
    response = await send('/api/parse', { method: 'POST', body: form, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) return { ok: false, error: `The server took longer than ${Math.round((opts.timeoutMs ?? PARSE_TIMEOUT_MS) / 1000)} seconds to answer.` };
    return { ok: false, error: `Couldn’t reach the server${err instanceof Error && err.message ? ` (${err.message})` : ''}.` };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = '';
    try {
      detail = String((await response.json())?.error ?? '');
    } catch {
      /* no JSON body */
    }
    return { ok: false, error: detail ? `${detail} (HTTP ${response.status})` : `The server answered with HTTP ${response.status}.` };
  }
  let data: { results?: Array<{ invoice: ParsedInvoice | null; error?: string }> };
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: 'The server sent an answer this page could not read.' };
  }
  const result = data.results?.[0];
  if (!result) return { ok: false, error: 'The server sent no result for this file.' };
  if (!result.invoice) return { ok: false, error: result.error ?? 'Unknown error' };
  return { ok: true, invoice: result.invoice };
}
