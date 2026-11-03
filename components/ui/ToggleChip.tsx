'use client';

import { Check, X } from 'lucide-react';
import { cx } from './cx';

interface ToggleChipProps {
  label: string;
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** Optional count shown after the label, e.g. type counts. */
  count?: number;
  /** Colour dot (series / type colour), shown after the check. Value is any CSS colour, e.g. "var(--rent)". */
  dotColor?: string;
  disabledReason?: string;
  className?: string;
  'data-state'?: 'hover';
}

/** Filter / legend toggle (plan §2.7.6): aria-pressed, check icon when on, never colour alone. */
export function ToggleChip({ label, pressed, onPressedChange, count, dotColor, disabledReason, className, ...rest }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={disabledReason ? true : undefined}
      title={disabledReason}
      className={cx('chip', className)}
      onClick={() => {
        if (!disabledReason) onPressedChange(!pressed);
      }}
      {...rest}
    >
      {pressed && <Check size={16} strokeWidth={2} aria-hidden="true" />}
      {dotColor && <span className="chip-dot" style={{ background: dotColor }} aria-hidden="true" />}
      <span className="bold-reserve" data-text={label}>
        {label}
      </span>
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}

interface RemovableChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

/** Active-filter chip: label + a separate 24 px remove button with its own accessible name. */
export function RemovableChip({ label, onRemove, className }: RemovableChipProps) {
  return (
    <span className={cx('chip chip-remove cursor-default', className)} style={{ cursor: 'default' }}>
      <span>{label}</span>
      <button type="button" className="chip-x" aria-label={`Remove filter: ${label}`} onClick={onRemove}>
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </span>
  );
}
