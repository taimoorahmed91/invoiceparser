'use client';

import { useId } from 'react';
import Link from 'next/link';
import { Tooltip } from '@/components/ui/Tooltip';
import { unavailableReason, type NavEntry } from './nav';

interface NavItemProps {
  entry: NavEntry;
  active: boolean;
  enabled: boolean;
  /** Sidebar / rail item (icon + label) or phone bottom tab (icon above label). */
  variant: 'side' | 'bottom';
  /** Show a tooltip with the label (rail mode, where the label is not visible). */
  tooltip?: boolean;
}

/**
 * One navigation entry.
 * - available: a real link; the current page has aria-current="page" (plus marker + background, not colour alone)
 * - not built yet: an aria-disabled button that stays focusable, with the reason read out and a "Soon" tag
 */
export function NavItem({ entry, active, enabled, variant, tooltip }: NavItemProps) {
  const reasonId = useId();
  const Icon = entry.icon;
  const cls = variant === 'side' ? 'nav-item' : 'bn-item';
  const iconSize = variant === 'side' ? 20 : 20;

  const inner = (
    <>
      <Icon className="nav-icon" size={iconSize} strokeWidth={1.75} aria-hidden="true" />
      {variant === 'side' ? <span className="nav-label">{entry.label}</span> : <span>{entry.label}</span>}
      {!enabled && variant === 'side' && (
        <span className="nav-soon" aria-hidden="true">
          Soon
        </span>
      )}
    </>
  );

  const reason = unavailableReason(entry);
  const node = enabled ? (
    <Link href={entry.href} className={cls} aria-current={active ? 'page' : undefined}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} aria-disabled="true" aria-describedby={reasonId}>
      {inner}
      <span id={reasonId} className="sr-only-text">
        {reason}
      </span>
    </button>
  );

  if (variant === 'bottom') return node;
  // Rail: tooltip with the label (plus the reason when not built yet). Expanded sidebar: the label is visible, no tooltip.
  return (
    <Tooltip content={enabled ? entry.label : `${entry.label} — ${reason}`} side="right" disabled={!tooltip} className="contents">
      {node}
    </Tooltip>
  );
}
