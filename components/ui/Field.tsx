'use client';

import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from './cx';

interface FieldProps {
  /** Id of the control inside, so the <label> is linked to it. */
  htmlFor: string;
  label?: string;
  helper?: string;
  error?: string;
  /** Ids of the helper / error text, to be set as aria-describedby on the control. */
  helperId: string;
  errorId: string;
  className?: string;
  children: ReactNode;
}

/** Label above, helper and error below (plan §2.7.8). Used by Input, Select, Search. */
export function Field({ htmlFor, label, helper, error, helperId, errorId, className, children }: FieldProps) {
  return (
    <div className={cx('field', className)}>
      {label && (
        <label htmlFor={htmlFor} className="field-label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p id={errorId} className="field-error">
          <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" className="mt-px flex-none" />
          <span>{error}</span>
        </p>
      ) : (
        helper && (
          <p id={helperId} className="field-help">
            {helper}
          </p>
        )
      )}
    </div>
  );
}
