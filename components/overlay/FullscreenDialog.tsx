'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface FullscreenDialogProps {
  /** Mounted only while open; unmounting closes it. */
  onClose: () => void;
  ariaLabel: string;
  /** Where focus goes when the dialog closes (the Expand button, or the "More" trigger on phones). */
  returnFocusTo: HTMLElement | null;
  children: ReactNode;
}

/**
 * Full screen for a chart or table (plan §4.11.5). A modal <dialog> is the reliable baseline
 * (focus trap, Esc, inert page, works on iOS where the Fullscreen API is not available for elements);
 * the Fullscreen API is only a progressive extra. Esc closes both; leaving native full screen also closes the dialog.
 */
export function FullscreenDialog({ onClose, ariaLabel, returnFocusTo, children }: FullscreenDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const wasNativeFullscreen = useRef(false);
  // Children mount only once the dialog is really showing, so charts measure a real size (a closed <dialog> is display:none).
  const [ready, setReady] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    setReady(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // scroll lock (risk R10)

    // Best effort: real full screen where the browser allows it. The dialog alone is already a complete experience.
    if (typeof dialog.requestFullscreen === 'function' && document.fullscreenEnabled) {
      dialog.requestFullscreen().catch(() => undefined);
    }

    const onFullscreenChange = () => {
      if (document.fullscreenElement === dialog) wasNativeFullscreen.current = true;
      else if (wasNativeFullscreen.current) closeRef.current(); // user left native full screen (Esc / browser UI)
    };
    const onCancel = (e: Event) => {
      e.preventDefault(); // we unmount instead, so focus restoration is in one place
      closeRef.current();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    dialog.addEventListener('cancel', onCancel);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      dialog.removeEventListener('cancel', onCancel);
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
      if (dialog.open) dialog.close();
    };
  }, []);

  // Focus returns to the control that opened it.
  useEffect(() => () => {
    const el = returnFocusTo;
    if (el && el.isConnected) requestAnimationFrame(() => el.focus());
  }, [returnFocusTo]);

  return (
    <dialog ref={ref} className="fs-dialog" aria-label={ariaLabel}>
      {ready ? children : null}
    </dialog>
  );
}
