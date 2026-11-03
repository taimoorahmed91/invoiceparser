'use client';

import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field } from './Field';
import { cx } from './cx';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'disabled'> {
  label?: string;
  helper?: string;
  error?: string;
  size?: 'sm' | 'md';
  disabledReason?: string;
  wrapperClassName?: string;
  forceState?: 'hover' | 'focus';
}

/** Native <select> (OS picker on phones, free keyboard behaviour) with a custom chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helper, error, size = 'md', disabledReason, wrapperClassName, forceState, id, children, ...rest },
  ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  const helperId = `${selectId}-help`;
  const errorId = `${selectId}-err`;
  const disabled = Boolean(disabledReason);

  return (
    <Field
      htmlFor={selectId}
      label={label}
      helper={disabledReason ?? helper}
      error={error}
      helperId={helperId}
      errorId={errorId}
      className={wrapperClassName}
    >
      <div
        className={cx('ctl ctl-select', size === 'sm' && 'ctl-sm')}
        data-invalid={error ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
        data-state={forceState}
      >
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helper || disabledReason ? helperId : undefined}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown className="ctl-chevron" size={16} strokeWidth={1.75} aria-hidden="true" />
      </div>
    </Field>
  );
});
