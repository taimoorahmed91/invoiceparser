/** Toast timing rules (plan §4.9). Pure, so they can be unit tested. */
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export const MAX_VISIBLE_TOASTS = 3;

/** ms before auto-dismiss; 0 = stays until dismissed. */
export function defaultDuration(type: ToastType, hasAction: boolean): number {
  if (type === 'error') return 0;
  if (hasAction) return 8000; // Undo toasts
  if (type === 'warning') return 6000;
  return 4000;
}

/** An explicit duration is honoured, except for errors, which always stay. */
export function resolveDuration(type: ToastType, hasAction: boolean, explicit?: number): number {
  if (type === 'error') return 0;
  if (explicit !== undefined) return explicit;
  return defaultDuration(type, hasAction);
}
