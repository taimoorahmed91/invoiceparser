import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

/** Inline error with an action (plan §4.0): errors are never toast-only. */
export function Banner({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] border border-danger bg-danger-tint px-4 py-3 text-[14px] leading-5 text-ink">
      <CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" className="flex-none text-danger" />
      <p className="flex-1 min-w-[200px]">{children}</p>
      {action}
    </div>
  );
}
