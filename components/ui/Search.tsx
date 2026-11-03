'use client';

import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { Search as SearchIcon, X } from 'lucide-react';
import { cx } from './cx';

interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name. Search has no visible label by design (plan §2.7.8). */
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Search box: leading icon, Clear button only while there is text, Esc clears. */
export const Search = forwardRef<HTMLInputElement, SearchProps>(function Search(
  { value, onChange, size = 'md', className, placeholder = 'Search…', ...rest },
  ref,
) {
  const id = useId();
  return (
    <div className={cx('ctl', size === 'sm' && 'ctl-sm', className)}>
      <SearchIcon className="ctl-affix" size={16} strokeWidth={1.75} aria-hidden="true" />
      <input
        ref={ref}
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            onChange('');
          }
          rest.onKeyDown?.(e);
        }}
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          className="chip-x"
          onClick={() => {
            onChange('');
            document.getElementById(id)?.focus();
          }}
        >
          <X size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});
