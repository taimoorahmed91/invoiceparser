#!/usr/bin/env node
/**
 * UI audit (plan §2.7.11 item 7). Drives headless Chrome over CDP and reports, for every
 * interactive element on a page:
 *   - target size   (mouse: >= 24 px; --touch: hit area >= 44 px, counting ::after extensions)
 *   - accessible name present
 *   - visible focus change when focused
 * and, on /dev/ui, the failures counted by the computed-contrast table.
 *
 * Usage: node scripts/ui-audit.mjs <url> [--touch] [--theme=light|dark] [--json]
 * Exit code 1 when anything is found. Needs Chrome (set CHROME_BIN to override) and Node 22+.
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const touch = args.includes('--touch');
const asJson = args.includes('--json');
const theme = (args.find((a) => a.startsWith('--theme=')) ?? '--theme=light').split('=')[1];
if (!url) {
  console.error('usage: node scripts/ui-audit.mjs <url> [--touch] [--theme=light|dark] [--json]');
  process.exit(2);
}

const chromeBin = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9500 + Math.floor(Math.random() * 400);
const profile = `/tmp/ui-audit-profile-${port}`;
const chrome = spawn(chromeBin, [`--remote-debugging-port=${port}`, '--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let targets = [];
for (let i = 0; i < 50 && !targets.length; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { /* retry */ }
  if (!targets.length) await sleep(200);
}
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', touch
  ? { width: 375, height: 800, deviceScaleFactor: 2, mobile: true }
  : { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
if (touch) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('invoice-parser-theme','${theme}')}catch(e){}` });
await send('Page.navigate', { url });
await sleep(4000);
// One real key press, so Chrome treats later focus() calls as keyboard focus (:focus-visible matches).
for (const type of ['rawKeyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });

const inPage = `(${function audit(touchMode) {
  const SEL = 'button, a[href], [role="button"], [role="radio"], [role="tab"], [role="menuitem"], input:not([type="hidden"]), select, summary';
  const findings = [];
  const seen = new Set();
  const hidden = (el) => !!el.closest('[aria-hidden="true"], [hidden], [inert]');
  const label = (el) => (el.getAttribute('aria-label') || el.getAttribute('data-contrast') || el.textContent || el.className || el.tagName).toString().trim().replace(/\s+/g, ' ').slice(0, 60);
  const describe = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${label(el)}"`;

  function hitRect(el) {
    const r = el.getBoundingClientRect();
    let { top, bottom, left, right } = r;
    const ps = getComputedStyle(el, '::after');
    if (ps.content !== 'none' && ps.position === 'absolute') {
      const px = (v) => (v === 'auto' ? 0 : parseFloat(v) || 0);
      top += px(ps.top); left += px(ps.left); bottom -= px(ps.bottom); right -= px(ps.right);
    }
    return { w: right - left, h: bottom - top, visualW: r.width, visualH: r.height };
  }
  function hasName(el) {
    if (el.getAttribute('aria-label')) return true;
    const lb = el.getAttribute('aria-labelledby');
    if (lb && lb.split(' ').some((i) => document.getElementById(i)?.textContent.trim())) return true;
    if (el.labels && [...el.labels].some((l) => l.textContent.trim())) return true;
    if ((el.textContent || '').trim()) return true;
    if (el.getAttribute('title')) return true;
    return false;
  }
  function focusRing(el) {
    // The element that actually shows the ring can be a wrapper (input in .ctl) or a sibling (checkbox box).
    const target = el.closest('.ctl') ?? (el.type === 'checkbox' ? el.nextElementSibling : el);
    const cs = getComputedStyle(target);
    return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow].join('|');
  }

  document.querySelectorAll(SEL).forEach((el) => {
    if (seen.has(el) || hidden(el)) return;
    seen.add(el);
    const isCheckbox = el.matches('input[type="checkbox"]');
    const measured = isCheckbox ? el.closest('label') ?? el : el.closest('.ctl') ?? el; // inputs: the visible box is the wrapper
    const r = hitRect(measured);
    if (r.visualW <= 1 || r.visualH <= 1) return; // visually hidden helper
    const name = describe(el);
    const forced = el.hasAttribute('data-state'); // gallery-forced states (pressed = scaled to 95%) are not real sizes
    const min = touchMode ? 44 : 24;
    const hit = Math.min(r.w, r.h);
    if (!forced && hit < min - 0.5) findings.push({ type: 'target-size', el: name, detail: `${hit.toFixed(1)}px < ${min}px (${touchMode ? 'hit area incl. ::after' : 'mouse'})` });
    if (!hasName(el)) findings.push({ type: 'no-name', el: name, detail: 'no accessible name' });
    try {
      if (el.getAttribute('data-state') === 'focus' || el.closest('[data-state="focus"]') || el.nextElementSibling?.getAttribute('data-state') === 'focus') return; // gallery forces a ring; nothing to compare
      const before = focusRing(el);
      el.focus({ preventScroll: true });
      const after = focusRing(el);
      if (document.activeElement === el && before === after) findings.push({ type: 'no-focus-style', el: name, detail: 'focus does not change outline/box-shadow' });
      el.blur();
    } catch (e) { /* ignore */ }
  });
  const summary = document.querySelector('[data-testid="contrast-summary"]');
  const contrastFailures = summary ? Number(summary.getAttribute('data-failures')) : null;
  return { checked: seen.size, findings, contrastFailures, contrastTotal: summary ? Number(summary.getAttribute('data-total')) : null };
}})(${touch})`;

const res = await send('Runtime.evaluate', { expression: inPage, returnByValue: true });
const out = res.result?.result?.value;
ws.close();
chrome.kill();
if (!out) { console.error('audit failed', JSON.stringify(res.result)); process.exit(2); }

const total = out.findings.length + (out.contrastFailures || 0);
if (asJson) console.log(JSON.stringify(out, null, 2));
else {
  console.log(`${url} (${touch ? 'touch 375px' : 'mouse 1440px'}, ${theme}): ${out.checked} interactive elements checked`);
  if (out.contrastTotal !== null) console.log(`computed contrast: ${out.contrastTotal} pairs, ${out.contrastFailures} failures`);
  for (const f of out.findings) console.log(`  [${f.type}] ${f.el} — ${f.detail}`);
  console.log(total === 0 ? 'OK: zero findings' : `${total} finding(s)`);
}
process.exit(total === 0 ? 0 : 1);
