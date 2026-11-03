'use client';

import { useEffect } from 'react';

const PRESSABLE = '.btn, .seg-item, .chip';
const MIN_HOLD_MS = 110; // long enough for the 90 ms press-in to be seen before the spring back

function pressable(target: EventTarget | null): HTMLElement | null {
  const el = (target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null;
  if (!el) return null;
  if (el.getAttribute('aria-disabled') === 'true' || el.getAttribute('aria-busy') === 'true') return null;
  return el;
}

/**
 * Mounted once in the root layout. Gives keyboard activation the same press feedback
 * as the mouse (CSS :active does not hold for Enter, and not in every browser for Space)
 * by toggling data-pressed on the focused control (see "Press feedback" in controls.css).
 * Also registers a no-op touchstart so iOS Safari applies :active to buttons.
 */
export function PressFeedback() {
  useEffect(() => {
    const held = new Map<HTMLElement, number>(); // element → time pressed

    const release = (el: HTMLElement) => {
      const since = held.get(el);
      if (since === undefined) return;
      held.delete(el);
      const wait = Math.max(0, MIN_HOLD_MS - (performance.now() - since));
      window.setTimeout(() => el.removeAttribute('data-pressed'), wait);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
      const el = pressable(e.target);
      if (!el || held.has(el)) return;
      held.set(el, performance.now());
      el.setAttribute('data-pressed', 'true');
      // Enter fires click on keydown and is gone by keyup; release on its own after the minimum hold.
      if (e.key === 'Enter') window.setTimeout(() => release(el), 0);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = (e.target as Element | null)?.closest?.(PRESSABLE) as HTMLElement | null;
      if (el) release(el);
    };
    const onFocusOut = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (held.has(el)) release(el);
    };
    const noop = () => {};

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('touchstart', noop, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('touchstart', noop);
    };
  }, []);

  return null;
}
