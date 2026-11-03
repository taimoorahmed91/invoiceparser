import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Empty / no-match panel (plan §4.10): icon, one sentence, one action. */
export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-border bg-surface px-6 py-12 text-center">
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" className="text-ink-muted" />
      <h2 className="text-[17px] leading-6 font-semibold">{title}</h2>
      {children && <p className="max-w-[46ch] text-[14px] leading-5 text-ink-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
