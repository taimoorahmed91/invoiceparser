/**
 * Places a `position: fixed` popover next to an anchor rectangle.
 * Used by Tooltip and MenuButton. The caller shows the popover first
 * (so it can be measured), then calls placeFixed().
 */
export interface PlaceOptions {
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
  gap?: number;
  margin?: number; // minimum distance from the viewport edge
}

export function placeFixed(panel: HTMLElement, anchor: DOMRect, opts: PlaceOptions = {}) {
  const { side = 'bottom', align = 'start', gap = 4, margin = 8 } = opts;
  const w = panel.offsetWidth;
  const h = panel.offsetHeight;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = align === 'start' ? anchor.left : align === 'end' ? anchor.right - w : anchor.left + anchor.width / 2 - w / 2;
  left = Math.max(margin, Math.min(left, vw - w - margin));

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - h;
  let top: number;
  if (side === 'bottom') {
    top = below + h <= vh - margin || above < margin ? below : above;
  } else {
    top = above >= margin || below + h > vh - margin ? above : below;
  }
  top = Math.max(margin, Math.min(top, vh - h - margin));

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

/** showPopover() with a safe fallback for browsers without the Popover API. */
export function showPopoverSafe(el: HTMLElement) {
  const anyEl = el as HTMLElement & { showPopover?: () => void; matches: (s: string) => boolean };
  try {
    if (typeof anyEl.showPopover === 'function' && !anyEl.matches(':popover-open')) anyEl.showPopover();
  } catch {
    /* already open or unsupported */
  }
}

export function hidePopoverSafe(el: HTMLElement) {
  const anyEl = el as HTMLElement & { hidePopover?: () => void };
  try {
    if (typeof anyEl.hidePopover === 'function' && anyEl.matches(':popover-open')) anyEl.hidePopover();
  } catch {
    /* ignore */
  }
}
