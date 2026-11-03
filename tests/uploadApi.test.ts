import { describe, expect, it } from 'vitest';
import { isPdfFile, parseViaApi } from '../lib/uploadApi';
import { invoice, line } from './fixtures/synthetic';

const file = (name: string, type = 'application/pdf') => new File(['%PDF-1.4'], name, { type });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const parsed = invoice([line('Rent', 100)], 'Rent', '03/11/2026').invoice;

describe('isPdfFile', () => {
  it('by type, or by name when the type is empty', () => {
    expect(isPdfFile({ name: 'a.pdf', type: 'application/pdf' })).toBe(true);
    expect(isPdfFile({ name: 'a.PDF', type: '' })).toBe(true);
    expect(isPdfFile({ name: 'a', type: 'application/x-pdf' })).toBe(true);
    expect(isPdfFile({ name: 'a.txt', type: 'text/plain' })).toBe(false);
    expect(isPdfFile({ name: 'a.txt', type: '' })).toBe(false);
    expect(isPdfFile({ name: 'fake.pdf', type: 'text/plain' })).toBe(false);
  });
});

describe('parseViaApi: one file per request to /api/parse', () => {
  it('posts exactly one "files" entry and returns the parsed invoice', async () => {
    let seen: FormData | null = null; let url = '';
    const r = await parseViaApi(file('a.pdf'), { fetch: (async (u: string, init: RequestInit) => { url = u; seen = init.body as FormData; return json({ results: [{ filename: 'a.pdf', invoice: parsed }] }); }) as unknown as typeof fetch });
    expect(url).toBe('/api/parse');
    expect(seen!.getAll('files')).toHaveLength(1);
    expect((seen!.get('files') as File).name).toBe('a.pdf');
    expect(r).toEqual({ ok: true, invoice: parsed });
  });

  it('a PDF with no type is re-sent with type application/pdf (the route refuses anything else)', async () => {
    let sent: File | null = null;
    await parseViaApi(file('scan.pdf', ''), { fetch: (async (_u: string, init: RequestInit) => { sent = (init.body as FormData).get('files') as File; return json({ results: [{ filename: 'scan.pdf', invoice: parsed }] }); }) as unknown as typeof fetch });
    expect(sent!.type).toBe('application/pdf');
    expect(sent!.name).toBe('scan.pdf');
  });

  it('the server\'s per-file error (corrupt PDF) comes back as the reason', async () => {
    const r = await parseViaApi(file('bad.pdf'), { fetch: (async () => json({ results: [{ filename: 'bad.pdf', invoice: null, error: 'Failed to parse PDF: Invalid PDF structure' }] })) as unknown as typeof fetch });
    expect(r).toEqual({ ok: false, error: 'Failed to parse PDF: Invalid PDF structure' });
  });

  it('HTTP errors, odd answers and a missing result are all plain failures', async () => {
    const f = (res: () => Response) => parseViaApi(file('a.pdf'), { fetch: (async () => res()) as unknown as typeof fetch });
    expect(await f(() => json({ error: 'Failed to process request' }, 500))).toEqual({ ok: false, error: 'Failed to process request (HTTP 500)' });
    expect(await f(() => new Response('<html>', { status: 502 }))).toEqual({ ok: false, error: 'The server answered with HTTP 502.' });
    expect(await f(() => new Response('nope', { status: 200 }))).toMatchObject({ ok: false, error: expect.stringContaining('could not read') });
    expect(await f(() => json({ results: [] }))).toMatchObject({ ok: false, error: expect.stringContaining('no result') });
  });

  it('no network → "Couldn\'t reach the server"; a hang → a timeout message', async () => {
    const down = await parseViaApi(file('a.pdf'), { fetch: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    expect(down).toEqual({ ok: false, error: 'Couldn’t reach the server (Failed to fetch).' });
    const hang = await parseViaApi(file('a.pdf'), { timeoutMs: 20, fetch: ((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch });
    expect(hang.ok).toBe(false);
    expect((hang as { error: string }).error).toMatch(/took longer than/);
  });
});
