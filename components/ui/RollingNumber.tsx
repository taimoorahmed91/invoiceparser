'use client';

import { useRef, type CSSProperties } from 'react';
import { cx } from './cx';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { planRoll, type RollSlot } from '@/lib/rolling';

const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface RollingNumberProps {
  /**
   * The already formatted text, e.g. fmtMoney(5935.09) → "5 935,09 zł", or "46".
   * Formatting stays in lib/format.ts; this component only animates the digits.
   */
  value: string;
  /** Announce changes to screen readers. Off by default; turn it on only where the plan says a value is live. */
  live?: 'polite' | 'assertive';
  className?: string;
}

/**
 * Odometer (plan §2.6 rule 5). Each digit is a 0–9 strip that slides to the new digit;
 * digits that change move one after another, left to right. Separators, minus and the
 * currency are static. Nothing animates on first render or under reduced motion.
 *
 * Accessibility: the real value sits in a visually hidden span (optionally aria-live);
 * the animated visual is aria-hidden. Visible digits stay selectable, so copy/paste gives the real number.
 */
export function RollingNumber({ value, live, className }: RollingNumberProps) {
  const reduced = useReducedMotion();

  // The plan is computed once per value and kept, so an unrelated re-render of the parent
  // cannot restart or cancel a roll that is already running.
  const memo = useRef<{ value: string | null; plan: RollSlot[] }>({ value: null, plan: [] });
  if (memo.current.value !== value) {
    memo.current = { value, plan: planRoll(memo.current.value, value, { reducedMotion: reduced }) };
  }

  return (
    <span className={cx('rolling-number', className)}>
      <span className="sr-only-text" aria-live={live} aria-atomic={live ? true : undefined}>
        {value}
      </span>
      <span className="roll-visual" aria-hidden="true">
        {memo.current.plan.map((slot) =>
          slot.kind === 'static' ? (
            <span key={slot.key} className="roll-static">
              {slot.char}
            </span>
          ) : (
            <span
              key={slot.key}
              className="roll-cell"
              data-entering={slot.entering ? 'true' : undefined}
              style={{ '--roll-delay': `${slot.delayMs}ms`, '--roll-dur': `${slot.durationMs}ms` } as CSSProperties}
            >
              {/* in-flow digit: gives the cell its width, height and baseline, and is the copyable text */}
              <span className="roll-ghost">{slot.digit}</span>
              <span className="roll-strip" style={{ transform: `translateY(${-slot.digit * 10}%)` }}>
                {STRIP.map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          ),
        )}
      </span>
    </span>
  );
}
