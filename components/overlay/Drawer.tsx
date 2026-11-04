'use client';

import { useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode } from 'react';

interface DrawerProps {
  /** Id of the heading inside `header` that names the drawer. */
  labelledBy: string;
  /** Top block that stays in view (badge, number, Prev / Next, Close). */
  header: ReactNode;
  /** Sticky bottom block (Save / Cancel in edit mode). */
  footer?: ReactNode;
  /** Called for Esc and a click on the scrim. The caller decides (it may first ask "discard changes?"). Mounted = open. */
  onClose: () => void;
  /** Read once, when the drawer closes: where focus goes (the row's number button). */
  getReturnFocus: () => HTMLElement | null;
  children: ReactNode;
}

/**
 * The invoice drawer (plan §4.4): a native modal <dialog>, so focus is trapped, Esc works, the page behind is inert and it sits in the
 * top layer. A panel on the right (560 / 640 px) from 768 px, a bottom sheet (92 dvh) on phones. Focus starts on `[data-autofocus]`.
 */
export function Drawer({ labelledBy, header, footer, onClose, getReturnFocus, children }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const returnRef = useRef(getReturnFocus);
  returnRef.current = getReturnFocus;

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
      const el = returnRef.current();
      if (el && el.isConnected) requestAnimationFrame(() => el.focus());
    },
    [],
  );

  // A click on the scrim lands on the <dialog> itself; clicks inside land on the panel.
  const onScrim = (e: MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <dialog ref={ref} className="drw" aria-labelledby={labelledBy} onClick={onScrim}>
      <div className="drw-panel">
        <span className="drw-handle" aria-hidden="true" />
        <div className="drw-head">{header}</div>
        <div className="drw-body">{children}</div>
        {footer && <div className="drw-foot">{footer}</div>}
      </div>
    </dialog>
  );
}
