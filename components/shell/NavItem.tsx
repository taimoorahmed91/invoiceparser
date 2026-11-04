'use client';

import Link from 'next/link';
import { Tooltip } from '@/components/ui/Tooltip';
import type { NavEntry } from './nav';

interface NavItemProps {
  entry: NavEntry;
  active: boolean;
  /** Sidebar / rail item (icon + label) or phone bottom tab (icon above label). */
  variant: 'side' | 'bottom';
  /** Show a tooltip with the label (rail mode, where the label is not visible). */
  tooltip?: boolean;
}

/**
 * One navigation entry: a real link. The current page has aria-current="page" (plus marker + background, not colour alone).
 */
export function NavItem({ entry, active, variant, tooltip }: NavItemProps) {
  const Icon = entry.icon;
  const cls = variant === 'side' ? 'nav-item' : 'bn-item';

  const node = (
    <Link href={entry.href} className={cls} aria-current={active ? 'page' : undefined}>
      <Icon className="nav-icon" size={20} strokeWidth={1.75} aria-hidden="true" />
      {variant === 'side' ? <span className="nav-label">{entry.label}</span> : <span>{entry.label}</span>}
    </Link>
  );

  if (variant === 'bottom') return node;
  // Rail: tooltip with the label. Expanded sidebar: the label is visible, no tooltip.
  return (
    <Tooltip content={entry.label} side="right" disabled={!tooltip} className="contents">
      {node}
    </Tooltip>
  );
}
