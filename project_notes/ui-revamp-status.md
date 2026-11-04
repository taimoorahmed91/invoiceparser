# UI revamp — final status (Phase 10)

All phases of `ui-revamp-plan.md` §7 are shipped. Four routes, one shell, shared primitives.

| Route | What it is | Notes |
|---|---|---|
| `/` | Overview: KPIs, monthly chart + table, latest invoices | rows open `/invoices?invoice=<id>` |
| `/invoices` | list, filters (mirrored to URL + `localStorage`), drawer, Compare, Export | `?invoice=<id>` deep link; Back/Esc close the drawer |
| `/analytics?tab=monthly\|utilities\|yoy` | charts, each a `ChartCard` | range, layout, metric in the URL |
| `/data` | manual heating values, import/export, sync, appearance, shortcuts, danger zone | |
| `/dev/ui` | control gallery + contrast table | 404 in production |

Global: Upload dialog (top bar, window-wide drop), toasts, theme (System / Light / Dark), `app/error.tsx`, `app/not-found.tsx`, `app/icon.svg` + `favicon.ico` + `apple-icon.png`.

## How the UI is checked

- `npx tsc --noEmit`, `npm test`, `npm run build` (build in a copy, not in place, while the dev server runs).
- `node scripts/ui-audit.mjs <url> [--touch | --width=768] [--theme=dark] [--pre=file.js]`: target sizes, accessible names, focus ring, per interactive element. Run it with `--pre` to open the drawer, the Compare dialog or the Upload dialog first.
- Phase 10 sweep (not committed, scripts were in `/tmp/ui-phase10`): per route × theme × 375/768/1440 — one `h1`, one `main`, labelled `nav`s, `lang`, per-route title, heading order, duplicate ids, dangling aria refs, horizontal overflow, computed text contrast (≥ 4.5:1, 3:1 large); keyboard Tab walk (skip link first, every stop shows a ring and is on screen); `prefers-reduced-motion` (no running animation > 50 ms).

## Rules that keep it consistent

- No raw `<button>`, `<select>`, checkbox outside `components/ui/` (`rg "<button|<select|type=\"checkbox\"" app components --glob "!components/ui/**"` is empty) and no `gray-*`/`orange-*`/… colour classes: tokens from `app/globals.css` only.
- Every chart is a `ChartCard`, every table a `DataPanel` (Chart | Table, Expand, Export).
- `lib/storage.ts`, `lib/parseInvoice.ts`, `lib/supabase.ts`, `app/api/parse/route.ts` were never changed by the revamp.

## Not done / known leftovers

- `tests/legacy-reference.ts` (the frozen copy of the old inline logic) is still there: seven test files compare against it live. Turning it into JSON snapshots is possible but was left, because the live comparison is the proof that numbers did not change.
- Plan §7 Phase 11 (storage hardening: non-atomic `saveManualValues`, `parsed_at` rewrite on edit, Undo re-upserting every invoice, import duplicates, anon key) needs an explicit OK and was not touched.
- Lighthouse was not run (no new dependency); the basics it checks (title, lang, landmarks, contrast, tap targets, bundle size) are covered by the sweep above.
- Optional "Needs review" card on Overview was not built.
