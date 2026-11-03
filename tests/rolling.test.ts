import { describe, it, expect } from 'vitest';
import { planRoll, totalRollMs, isDigit, ROLL_DEFAULTS, type RollSlot } from '../lib/rolling';
import { fmtMoney, fmtMoneyWhole } from '../lib/format';

const digits = (plan: RollSlot[]) => plan.filter((s): s is Extract<RollSlot, { kind: 'digit' }> => s.kind === 'digit');
const moving = (plan: RollSlot[]) => digits(plan).filter((d) => d.animate);

describe('planRoll — what moves', () => {
  it('first render never animates', () => {
    const plan = planRoll(null, '5 935,09 zł');
    expect(moving(plan)).toHaveLength(0);
    expect(totalRollMs(plan)).toBe(0);
    expect(digits(plan).every((d) => d.durationMs === 0)).toBe(true);
  });

  it('identical value: nothing moves', () => {
    expect(moving(planRoll('1 234,50 zł', '1 234,50 zł'))).toHaveLength(0);
  });

  it('only the digit that changed moves, and it starts at once', () => {
    const plan = planRoll('1 234,50 zł', '1 234,51 zł');
    const m = moving(plan);
    expect(m).toHaveLength(1);
    expect(m[0].digit).toBe(1);
    expect(m[0].delayMs).toBe(0);
    expect(m[0].durationMs).toBe(ROLL_DEFAULTS.durationMs);
  });

  it('separators, currency and minus stay static', () => {
    const plan = planRoll('−80,00 zł', '−95,00 zł');
    expect(plan.filter((s) => s.kind === 'static').length).toBe(5); // −  ,  (space)  z  ł
    expect(moving(plan).map((d) => d.digit)).toEqual([9, 5]);
  });

  it('works on plain counts', () => {
    expect(moving(planRoll('46', '47')).map((d) => d.digit)).toEqual([7]);
    expect(moving(planRoll('9', '10')).map((d) => [d.digit, d.entering])).toEqual([
      [1, true],
      [0, false],
    ]);
  });

  it('also works with real fmtMoney output (NBSP separators)', () => {
    const plan = planRoll(fmtMoney(5935.09), fmtMoney(5935.19));
    expect(moving(plan)).toHaveLength(1);
    expect(plan.some((s) => s.kind === 'static' && s.char === '\u00a0')).toBe(true);
    const whole = planRoll(fmtMoneyWhole(140899.27), fmtMoneyWhole(140899.7));
    expect(moving(whole).map((d) => d.digit)).toEqual([9, 0, 0]); // 140 899 → 140 900: three columns change, the rest stay
  });
});

describe('planRoll — stagger', () => {
  it('moving digits start one after another, left to right, 40 ms apart', () => {
    const m = moving(planRoll('1 111,11 zł', '2 222,22 zł'));
    expect(m.map((d) => d.digit)).toEqual([2, 2, 2, 2, 2, 2]);
    expect(m.map((d) => d.delayMs)).toEqual([0, 40, 80, 120, 160, 200]);
  });

  it('unchanged digits do not use up a delay step', () => {
    const m = moving(planRoll('1 111,11 zł', '1 211,41 zł'));
    expect(m.map((d) => [d.digit, d.delayMs])).toEqual([
      [2, 0],
      [4, 40],
    ]);
  });

  it('delay is capped so long numbers do not drag', () => {
    const m = moving(planRoll('0000000000000000', '1111111111111111'));
    expect(Math.max(...m.map((d) => d.delayMs))).toBe((ROLL_DEFAULTS.maxSteps - 1) * ROLL_DEFAULTS.staggerMs);
    expect(totalRollMs(planRoll('0000000000000000', '1111111111111111'))).toBe(
      (ROLL_DEFAULTS.maxSteps - 1) * ROLL_DEFAULTS.staggerMs + ROLL_DEFAULTS.durationMs,
    );
  });

  it('custom stagger and duration are honoured', () => {
    const m = moving(planRoll('11', '22', { staggerMs: 100, durationMs: 300 }));
    expect(m.map((d) => d.delayMs)).toEqual([0, 100]);
    expect(m.every((d) => d.durationMs === 300)).toBe(true);
  });
});

describe('planRoll — length changes (aligned from the right)', () => {
  it('999,00 zł → 1 000,00 zł: existing columns stay in place, new leading digit enters', () => {
    const next = `1\u00a0000,00\u00a0zł`;
    const plan = planRoll(`999,00\u00a0zł`, next);
    const d = digits(plan);
    // columns from the right: 0 0 , 0(9) 0(9) 0(9) nbsp 1  → the three 9→0 change, "1" enters
    expect(d.map((x) => x.digit)).toEqual([1, 0, 0, 0, 0, 0]);
    expect(moving(plan).map((x) => [x.digit, x.entering])).toEqual([
      [1, true],
      [0, false],
      [0, false],
      [0, false],
    ]);
    // same key (= same DOM node) for the same column from the right
    expect(plan[plan.length - 1].key).toBe('r0');
  });

  it('shrinking: the shorter string simply has fewer slots, nothing animates for removed ones', () => {
    const plan = planRoll(`1\u00a0000`, '999');
    expect(plan).toHaveLength(3);
    expect(moving(plan).map((d) => d.digit)).toEqual([9, 9, 9]);
  });

  it('a digit replacing a separator counts as entering', () => {
    const plan = planRoll('1,5', '12,5');
    const d = digits(plan);
    expect(d[0].entering).toBe(true);
    expect(d[1].entering).toBe(false);
  });
});

describe('planRoll — reduced motion', () => {
  it('disables every animation: no slot moves, no delay, no duration', () => {
    const plan = planRoll('1 111,11 zł', '2 222,22 zł', { reducedMotion: true });
    expect(moving(plan)).toHaveLength(0);
    expect(digits(plan).every((d) => d.delayMs === 0 && d.durationMs === 0 && !d.entering)).toBe(true);
    expect(totalRollMs(plan)).toBe(0);
  });
  it('still returns the NEW digits so the value is swapped immediately', () => {
    const plan = planRoll('11', '29', { reducedMotion: true });
    expect(digits(plan).map((d) => d.digit)).toEqual([2, 9]);
  });
});

describe('isDigit', () => {
  it('accepts only ASCII 0–9', () => {
    expect(isDigit('7')).toBe(true);
    expect(isDigit(',')).toBe(false);
    expect(isDigit('\u00a0')).toBe(false);
    expect(isDigit('٣')).toBe(false);
    expect(isDigit(undefined)).toBe(false);
  });
});
