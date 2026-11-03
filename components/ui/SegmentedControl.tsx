'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx';
import { Tooltip } from './Tooltip';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Makes the option unavailable and says why (tooltip + caption under the control). */
  disabledReason?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  size?: 'sm' | 'md';
  /** Equal-width items filling the row (phones). */
  fullWidth?: boolean;
  /** Print the reasons of unavailable options under the control so touch users see them. */
  showReasons?: boolean;
  className?: string;
  /** Forces a state for the gallery. */
  forceHoverValue?: T;
}

/**
 * Radiogroup with roving focus (plan §2.7.6): one Tab stop, arrows move AND select,
 * Home/End jump, unavailable options are skipped by the arrows.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
  showReasons = true,
  className,
  forceHoverValue,
  ...aria
}: SegmentedControlProps<T>) {
  const captionId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabledIdx = options.map((o, i) => (o.disabledReason ? -1 : i)).filter((i) => i >= 0);
  const selectedIdx = options.findIndex((o) => o.value === value);
  const tabStop = selectedIdx >= 0 && !options[selectedIdx].disabledReason ? selectedIdx : enabledIdx[0];
  const reasons = options.filter((o) => o.disabledReason).map((o) => o.disabledReason as string);

  const move = (from: number, dir: 1 | -1 | 'first' | 'last') => {
    if (enabledIdx.length === 0) return;
    let target: number;
    if (dir === 'first') target = enabledIdx[0];
    else if (dir === 'last') target = enabledIdx[enabledIdx.length - 1];
    else {
      const pos = enabledIdx.indexOf(from);
      target = enabledIdx[(pos + dir + enabledIdx.length) % enabledIdx.length];
    }
    onChange(options[target].value);
    refs.current[target]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        e.preventDefault();
        move(index, 'first');
        break;
      case 'End':
        e.preventDefault();
        move(index, 'last');
        break;
    }
  };

  return (
    <div className={cx('inline-flex flex-col items-start gap-1', fullWidth && 'w-full items-stretch', className)}>
      <div role="radiogroup" className={cx('seg', `seg-${size}`, fullWidth && 'seg-full')} {...aria}>
        {options.map((o, i) => {
          const checked = o.value === value;
          const Icon = o.icon;
          const item = (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={o.disabledReason ? true : undefined}
              aria-describedby={o.disabledReason && showReasons ? captionId : undefined}
              tabIndex={i === tabStop ? 0 : -1}
              data-state={forceHoverValue === o.value ? 'hover' : undefined}
              className="seg-item"
              onClick={() => {
                if (!o.disabledReason) onChange(o.value);
              }}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden="true" />}
              <span className="bold-reserve" data-text={o.label}>
                {o.label}
              </span>
            </button>
          );
          return o.disabledReason ? (
            <Tooltip key={o.value} content={o.disabledReason} className="contents">
              {item}
            </Tooltip>
          ) : (
            item
          );
        })}
      </div>
      {showReasons && reasons.length > 0 && (
        <p id={captionId} className="w-0 min-w-full text-[12px] leading-4 text-ink-subtle">
          {reasons.join(' ')}
        </p>
      )}
    </div>
  );
}
