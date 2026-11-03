'use client';

import { useEffect, useId, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';

interface DialogProps {
  title: string;
  /** One or two plain sentences under the title; read out when the dialog opens. */
  description?: ReactNode;
  /** Buttons, safest first (Cancel), the action last. Put `data-autofocus` on the one that should get focus. */
  actions: ReactNode;
  /** Mounted only while open; unmounting closes it. Called for Esc and for a click outside. */
  onClose: () => void;
  /** Where focus goes when it closes (the button that opened it). */
  returnFocusTo: HTMLElement | null;
  children?: ReactNode;
}

/**
 * A small modal confirm (plan §4.8 Danger zone). A native modal <dialog>: focus is trapped, Esc and the browser's back-gesture close it,
 * the page behind is inert. Focus starts on the control marked `data-autofocus` (Cancel for anything destructive) and returns to the opener.
 */
export function Dialog({ title, description, actions, onClose, returnFocusTo, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    const onCancel = (e: Event) => {
      e.preventDefault(); // unmounting closes it, so focus restoration lives in one place
      closeRef.current();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
      document.body.style.overflow = prevOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(
    () => () => {
      const el = returnFocusTo;
      if (el && el.isConnected) requestAnimationFrame(() => el.focus());
    },
    [returnFocusTo],
  );

  // A click on the backdrop lands on the <dialog> itself; clicks inside land on the body.
  const onBackdrop = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog ref={ref} className="dlg" aria-labelledby={titleId} aria-describedby={description ? descId : undefined} onClick={onBackdrop}>
      <div className="dlg-body">
        <h2 id={titleId} className="dlg-title">{title}</h2>
        {description && <p id={descId} className="dlg-desc">{description}</p>}
        {children}
        <div className="dlg-actions">{actions}</div>
      </div>
    </dialog>
  );
}
