'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { hidePopoverSafe, placeFixed, showPopoverSafe } from './placement';

interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'right';
  /** Wire the tooltip to the child with aria-describedby. Leave off when the child already has the same text as aria-label. */
  describe?: boolean;
  /** Replaces the wrapper classes (default "inline-flex"). Use "flex w-full" for full-width children, "contents" inside a flex row. */
  className?: string;
  /** Skip the tooltip entirely (keeps the call site simple). */
  disabled?: boolean;
}

const HOVER_DELAY = 400; // plan §2.7.4: 400 ms on hover, instant on keyboard focus
const CLOSE_DELAY = 150; // lets the pointer travel onto the tooltip (WCAG 1.4.13 hoverable)

export function Tooltip({ content, children, side = 'top', describe = false, className, disabled }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLSpanElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clear = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  const scheduleOpen = useCallback((delay: number) => {
    clear();
    openTimer.current = setTimeout(() => setOpen(true), delay);
  }, []);
  const scheduleClose = useCallback((delay: number) => {
    clear();
    closeTimer.current = setTimeout(() => setOpen(false), delay);
  }, []);
  useEffect(() => clear, []);

  // Show in the top layer and place next to the trigger.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const wrap = wrapRef.current;
    if (!panel || !wrap) return;
    showPopoverSafe(panel);
    const anchor = (wrap.firstElementChild as HTMLElement | null) ?? wrap;
    placeFixed(panel, anchor.getBoundingClientRect(), { side, align: 'center', gap: side === 'right' ? 12 : 8 });
  }, [open, side, content]);

  // Esc dismisses; scrolling or resizing closes (position would be stale).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      if (panelRef.current) hidePopoverSafe(panelRef.current);
    };
  }, [open]);

  if (disabled || !content) return children;

  const child =
    describe && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': id })
      : children;

  return (
    <span
      ref={wrapRef}
      className={className ?? 'inline-flex'}
      onMouseEnter={() => scheduleOpen(HOVER_DELAY)}
      onMouseLeave={() => scheduleClose(CLOSE_DELAY)}
      onFocus={(e) => {
        // Keyboard focus only; a mouse click should not pop the tooltip open again.
        if ((e.target as HTMLElement).matches?.(':focus-visible')) scheduleOpen(0);
      }}
      onBlur={() => scheduleClose(0)}
    >
      {child}
      {open && (
        <span
          ref={panelRef}
          id={id}
          role="tooltip"
          // Icon-only buttons already carry the text in aria-label: hide the tooltip from AT to avoid double reading.
          aria-hidden={describe ? undefined : true}
          popover="manual"
          className="tooltip-panel"
          onMouseEnter={clear}
          onMouseLeave={() => scheduleClose(CLOSE_DELAY)}
        >
          {content}
        </span>
      )}
    </span>
  );
}
