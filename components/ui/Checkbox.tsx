'use client';

import { forwardRef, useEffect, useId, useRef, type InputHTMLAttributes } from 'react';
import { Check, Minus } from 'lucide-react';
import { cx } from './cx';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'disabled' | 'size'> {
  /** Visible label. Without one, pass aria-label ("Select FA/MYS/124/11/2026"). */
  label?: string;
  indeterminate?: boolean;
  /** Makes the box the whole 40 × 40 cell (44 on touch), for table rows. */
  cell?: boolean;
  /** Disabled needs a reason: shown as a tooltip text and read by screen readers (aria-disabled keeps it focusable). */
  disabledReason?: string;
  /** Gallery only. */
  'data-box-state'?: 'checked' | 'focus';
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate, cell, disabledReason, className, onChange, onClick, 'data-box-state': boxState, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement | null>(null);
  const reasonId = useId();
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return (
    <label
      className={cx('cb', className)}
      data-cell={cell ? 'true' : undefined}
      aria-disabled={disabledReason ? true : undefined}
      title={disabledReason}
    >
      <input
        {...rest}
        ref={(el) => {
          inner.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type="checkbox"
        aria-disabled={disabledReason ? true : undefined}
        aria-describedby={disabledReason ? reasonId : rest['aria-describedby']}
        onClick={(e) => {
          if (disabledReason) {
            e.preventDefault(); // aria-disabled does not block a native checkbox on its own
            return;
          }
          onClick?.(e);
        }}
        onChange={(e) => {
          if (!disabledReason) onChange?.(e);
        }}
      />
      <span className="cb-box" data-state={boxState} aria-hidden="true">
        {indeterminate ? <Minus size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={2.5} />}
      </span>
      {label && <span>{label}</span>}
      {disabledReason && (
        <span id={reasonId} className="sr-only-text">
          {disabledReason}
        </span>
      )}
    </label>
  );
});
