'use client';

import { forwardRef, useId, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx, type ControlSize } from './cx';
import { Tooltip } from './Tooltip';
import { Spinner } from './Spinner';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'children' | 'aria-label'> {
  /** Required: becomes the aria-label and the tooltip text. An icon-only button cannot exist without a name. */
  label: string;
  icon: LucideIcon;
  variant?: 'ghost' | 'secondary';
  size?: ControlSize;
  loading?: boolean;
  /** Same rule as Button: disabled needs a reason. */
  disabledReason?: string;
  'data-state'?: 'hover' | 'active' | 'focus';
}

/** Icon sizes for icon-only buttons: 16 in sm, 20 in md and lg (plan §2.5 / §2.7.3). */
const ICON_ONLY_SIZE: Record<ControlSize, number> = { sm: 16, md: 20, lg: 20 };

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, variant = 'ghost', size = 'md', loading, disabledReason, className, onClick, type = 'button', ...rest },
  ref,
) {
  const reasonId = useId();
  const unavailable = Boolean(disabledReason) || Boolean(loading);
  const tip = disabledReason ? `${label} — ${disabledReason}` : label;
  return (
    <Tooltip content={tip}>
      <button
        ref={ref}
        type={type}
        aria-label={label}
        aria-disabled={unavailable || undefined}
        aria-busy={loading || undefined}
        aria-describedby={disabledReason ? reasonId : undefined}
        className={cx('btn btn-icon', `btn-${size}`, `btn-${variant}`, className)}
        onClick={(e) => {
          if (unavailable) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
        {...rest}
      >
        {loading ? <Spinner size={ICON_ONLY_SIZE[size]} /> : <Icon size={ICON_ONLY_SIZE[size]} strokeWidth={1.75} aria-hidden="true" />}
        {disabledReason && (
          <span id={reasonId} className="sr-only-text">
            {disabledReason}
          </span>
        )}
      </button>
    </Tooltip>
  );
});
