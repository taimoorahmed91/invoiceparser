'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import type { ControlSize } from './cx';
import { hidePopoverSafe, placeFixed, showPopoverSafe } from './placement';

/**
 * A button that opens a small panel with controls in it (the Period picker). Same native Popover API as MenuButton:
 * top layer, Esc and click-outside close it, focus goes in on open and back to the button on close.
 * `children` can be a function that receives `close`.
 */
export function PopoverButton({
  label, icon, size = 'md', align = 'start', panelLabel, children, className,
}: {
  label: string;
  icon?: LucideIcon;
  size?: ControlSize;
  align?: 'start' | 'end';
  /** Accessible name of the panel (defaults to the button label). */
  panelLabel?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  className?: string;
}) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  const wasOpenOnPointerDown = useRef(false);
  const [open, setOpen] = useState(false);

  const close = useCallback((restoreFocus: boolean) => {
    returnFocus.current = restoreFocus;
    if (panelRef.current) hidePopoverSafe(panelRef.current);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (e: Event) => {
      const isOpen = (e as Event & { newState?: string }).newState === 'open';
      setOpen(isOpen);
      if (!isOpen && returnFocus.current) {
        triggerRef.current?.focus();
        returnFocus.current = false;
      }
    };
    panel.addEventListener('toggle', onToggle);
    return () => panel.removeEventListener('toggle', onToggle);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;
    placeFixed(panel, trigger.getBoundingClientRect(), { side: 'bottom', align, gap: 4 });
    panel.querySelector<HTMLElement>('input, select, button, [href], [tabindex]:not([tabindex="-1"])')?.focus();
  }, [open, align]);

  // a stale position: close on resize (not on scroll inside the panel, and not on page scroll caused by focusing)
  useEffect(() => {
    if (!open) return;
    const onResize = () => close(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, close]);

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') returnFocus.current = true; // the browser closes it; we return focus on toggle
  };

  return (
    <>
      <Button
        ref={triggerRef}
        variant="secondary"
        size={size}
        icon={icon}
        iconEnd={ChevronDown}
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onPointerDown={() => {
          wasOpenOnPointerDown.current = open;
        }}
        onClick={() => {
          if (wasOpenOnPointerDown.current) {
            wasOpenOnPointerDown.current = false;
            triggerRef.current?.focus();
            return;
          }
          if (open) close(true);
          else if (panelRef.current) showPopoverSafe(panelRef.current);
        }}
      >
        {label}
      </Button>
      <div ref={panelRef} id={panelId} role="dialog" aria-label={panelLabel ?? label} popover="auto" className="pop-panel" onKeyDown={onPanelKeyDown}>
        {typeof children === 'function' ? children((restore = true) => close(restore)) : children}
      </div>
    </>
  );
}
