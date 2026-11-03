'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Field } from './Field';
import { cx } from './cx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'disabled' | 'prefix'> {
  label?: string;
  helper?: string;
  error?: string;
  size?: 'sm' | 'md';
  /** Money / quantity: text input with decimal keyboard, right-aligned, tabular digits, no spinners. */
  numeric?: boolean;
  /** Read-only text inside the box after the value, e.g. "zł". */
  suffix?: ReactNode;
  prefixNode?: ReactNode;
  /** Same rule as Button: disabled needs a reason (shown as helper text). */
  disabledReason?: string;
  wrapperClassName?: string;
  /** Gallery only: draw a state without real interaction. */
  forceState?: 'hover' | 'focus';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, size = 'md', numeric, suffix, prefixNode, disabledReason, wrapperClassName, forceState, className, id, type, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const helperId = `${inputId}-help`;
  const errorId = `${inputId}-err`;
  const disabled = Boolean(disabledReason);
  const describedBy = error ? errorId : helper || disabledReason ? helperId : undefined;

  return (
    <Field
      htmlFor={inputId}
      label={label}
      helper={disabledReason ?? helper}
      error={error}
      helperId={helperId}
      errorId={errorId}
      className={wrapperClassName}
    >
      <div
        className={cx('ctl', size === 'sm' && 'ctl-sm', numeric && 'ctl-numeric')}
        data-invalid={error ? 'true' : undefined}
        data-disabled={disabled ? 'true' : undefined}
        data-state={forceState}
      >
        {prefixNode && <span className="ctl-affix">{prefixNode}</span>}
        <input
          ref={ref}
          id={inputId}
          type={numeric ? 'text' : type ?? 'text'}
          inputMode={numeric ? 'decimal' : rest.inputMode}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={className}
          {...rest}
        />
        {suffix && <span className="ctl-affix">{suffix}</span>}
      </div>
    </Field>
  );
});
