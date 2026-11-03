'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Prefix used to link tabs and panels: tab id = `${idBase}-tab-${id}`, panel id = `${idBase}-panel-${id}`. */
  idBase: string;
  'aria-label': string;
  className?: string;
  forceHoverId?: T;
}

/** ARIA tab pattern: ←/→ move and select, Home/End jump, one Tab stop. */
export function Tabs<T extends string>({ tabs, value, onChange, idBase, className, forceHoverId, ...aria }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const go = (i: number) => {
    const n = (i + tabs.length) % tabs.length;
    onChange(tabs[n].id);
    refs.current[n]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(tabs.length - 1); }
  };
  return (
    <div role="tablist" className={cx('tabs', className)} {...aria}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${t.id}`}
          aria-controls={`${idBase}-panel-${t.id}`}
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
          data-state={forceHoverId === t.id ? 'hover' : undefined}
          className="tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <span className="bold-reserve" data-text={t.label}>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}
