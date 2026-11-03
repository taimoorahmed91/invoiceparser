/** Tiny class-name joiner (no dependency). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type ControlSize = 'sm' | 'md' | 'lg';
