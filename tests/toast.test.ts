import { describe, it, expect } from 'vitest';
import { defaultDuration, resolveDuration, MAX_VISIBLE_TOASTS } from '../components/toast/duration';

describe('toast timing (plan §4.9)', () => {
  it('success and info last 4 s, warning 6 s', () => {
    expect(defaultDuration('success', false)).toBe(4000);
    expect(defaultDuration('info', false)).toBe(4000);
    expect(defaultDuration('warning', false)).toBe(6000);
  });
  it('Undo (action) toasts last 8 s', () => {
    expect(defaultDuration('success', true)).toBe(8000);
    expect(defaultDuration('warning', true)).toBe(8000);
  });
  it('errors stay until dismissed, even if the old call passes a duration', () => {
    expect(defaultDuration('error', false)).toBe(0);
    expect(resolveDuration('error', false, 5000)).toBe(0);
    expect(resolveDuration('error', true, 3000)).toBe(0);
  });
  it('an explicit duration is honoured for non-errors', () => {
    expect(resolveDuration('warning', false, 5000)).toBe(5000);
    expect(resolveDuration('info', false, undefined)).toBe(4000);
  });
  it('shows at most 3 at once', () => {
    expect(MAX_VISIBLE_TOASTS).toBe(3);
  });
});
