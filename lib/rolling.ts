/**
 * Odometer planning (plan §2.6 rule 5). Pure: decides which characters are digit
 * strips, which of them move, and when each one starts. Rendering is in
 * components/ui/RollingNumber.tsx.
 *
 * Rules
 *  - Strings are aligned from the RIGHT, so "999,00 zł" → "1 000,00 zł" keeps every
 *    existing digit in its own column and only the new leading characters are added.
 *  - Only ASCII digits roll. Separators, NBSP, the minus sign and "zł" are static.
 *  - A digit that stays the same does not move and does not use up a delay step.
 *  - Moving digits start left → right (reading order), 40 ms apart, capped at 8 steps
 *    so a long number never takes more than ~0.84 s in total.
 *  - First render (prev = null) and reduced motion: nothing animates.
 */
export interface RollOptions {
  /** User asked for reduced motion: every slot is returned with animate=false and 0 ms. */
  reducedMotion?: boolean;
  staggerMs?: number;
  durationMs?: number;
  /** Highest number of stagger steps (so delay never exceeds (maxSteps - 1) × stagger). */
  maxSteps?: number;
}

export const ROLL_DEFAULTS = { staggerMs: 40, durationMs: 520, maxSteps: 8 } as const;

export type RollSlot =
  | { kind: 'static'; key: string; char: string }
  | {
      kind: 'digit';
      key: string;
      digit: number;
      /** true when this slot should move (digit changed, or a new digit column appeared). */
      animate: boolean;
      /** A new column (the number got longer): fades/slides in instead of rolling from another digit. */
      entering: boolean;
      delayMs: number;
      durationMs: number;
    };

export function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch.length === 1 && ch >= '0' && ch <= '9';
}

export function planRoll(prev: string | null, next: string, opts: RollOptions = {}): RollSlot[] {
  const stagger = opts.staggerMs ?? ROLL_DEFAULTS.staggerMs;
  const duration = opts.durationMs ?? ROLL_DEFAULTS.durationMs;
  const maxSteps = Math.max(1, opts.maxSteps ?? ROLL_DEFAULTS.maxSteps);
  const motion = prev !== null && !opts.reducedMotion;

  const nextChars = Array.from(next);
  const prevChars = prev === null ? [] : Array.from(prev);
  let rank = 0;

  return nextChars.map((ch, i) => {
    const fromRight = nextChars.length - 1 - i;
    const key = `r${fromRight}`;
    if (!isDigit(ch)) return { kind: 'static', key, char: ch };

    const prevCh = prevChars[prevChars.length - 1 - fromRight];
    const entering = motion && !isDigit(prevCh);
    const changed = motion && isDigit(prevCh) && prevCh !== ch;
    const animate = entering || changed;
    const delayMs = animate ? Math.min(rank++, maxSteps - 1) * stagger : 0;
    return {
      kind: 'digit',
      key,
      digit: Number(ch),
      animate,
      entering,
      delayMs,
      durationMs: motion ? duration : 0,
    };
  });
}

/** Time until the last moving digit has settled (0 when nothing moves). */
export function totalRollMs(plan: RollSlot[]): number {
  let end = 0;
  for (const s of plan) if (s.kind === 'digit' && s.animate) end = Math.max(end, s.delayMs + s.durationMs);
  return end;
}
