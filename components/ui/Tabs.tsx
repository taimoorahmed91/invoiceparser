'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import { cx } from './cx';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Tab exists but cannot be opened yet: shown with a "Soon" tag, aria-disabled, reason read out. */
  disabledReason?: string;
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

/** ARIA tab pattern: ←/→ move and select (unavailable tabs are skipped), Home/End jump, one Tab stop. */
export function Tabs<T extends string>({ tabs, value, onChange, idBase, className, forceHoverId, ...aria }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const reasonBase = useId();
  const enabled = tabs.map((t, i) => (t.disabledReason ? -1 : i)).filter((i) => i >= 0);

  const go = (from: number, dir: 1 | -1 | 'first' | 'last') => {
    if (!enabled.length) return;
    let target: number;
    if (dir === 'first') target = enabled[0];
    else if (dir === 'last') target = enabled[enabled.length - 1];
    else {
      const pos = enabled.indexOf(from);
      target = enabled[(pos + dir + enabled.length) % enabled.length];
    }
    onChange(tabs[target].id);
    refs.current[target]?.focus();
  };
  const onKeyDown = (e: KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i, -1); }
    else if (e.key === 'Home') { e.preventDefault(); go(i, 'first'); }
    else if (e.key === 'End') { e.preventDefault(); go(i, 'last'); }
  };
  const tabStop = tabs.findIndex((t) => t.id === value && !t.disabledReason);

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
          aria-controls={t.disabledReason ? undefined : `${idBase}-panel-${t.id}`}
          aria-selected={t.id === value}
          aria-disabled={t.disabledReason ? true : undefined}
          aria-describedby={t.disabledReason ? `${reasonBase}-${t.id}` : undefined}
          tabIndex={i === (tabStop >= 0 ? tabStop : enabled[0]) ? 0 : -1}
          data-state={forceHoverId === t.id ? 'hover' : undefined}
          className="tab"
          onClick={() => {
            if (!t.disabledReason) onChange(t.id);
          }}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          <span className="bold-reserve" data-text={t.label}>
            {t.label}
          </span>
          {t.disabledReason && (
            <>
              <span className="tab-soon" aria-hidden="true">Soon</span>
              <span id={`${reasonBase}-${t.id}`} className="sr-only-text">
                {t.disabledReason}
              </span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
