'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Ellipsis, type LucideIcon } from 'lucide-react';
import { Button, type ButtonVariant } from './Button';
import { IconButton } from './IconButton';
import type { ControlSize } from './cx';
import { hidePopoverSafe, placeFixed, showPopoverSafe } from './placement';

export type MenuEntry =
  | {
      type?: 'item';
      label: string;
      description?: string;
      icon?: LucideIcon;
      shortcut?: string;
      /** Danger text; put it last, after a separator. */
      destructive?: boolean;
      /** Unavailable: shown dimmed with this reason as the second line (stays focusable). */
      disabledReason?: string;
      onSelect: () => void;
    }
  | { type: 'separator' }
  | { type: 'group'; label: string };

interface MenuButtonBase {
  entries: MenuEntry[];
  /** Which edge of the trigger the panel lines up with. Use "end" for triggers in a right-aligned group. */
  align?: 'start' | 'end';
  className?: string;
}

interface MenuButtonText extends MenuButtonBase {
  trigger?: 'button';
  label: string;
  icon?: LucideIcon;
  variant?: Exclude<ButtonVariant, 'link' | 'destructive'>;
  size?: ControlSize;
}

interface MenuButtonIcon extends MenuButtonBase {
  trigger: 'icon';
  /** Accessible name of the icon-only trigger, e.g. "Actions for FA/MYS/124/11/2026". */
  label: string;
  icon?: LucideIcon;
  variant?: 'ghost' | 'secondary';
  size?: ControlSize;
}

export type MenuButtonProps = MenuButtonText | MenuButtonIcon;

/**
 * Menu button (plan §2.7.7). Uses the native Popover API: top layer (never clipped by
 * overflow), light-dismiss and Esc for free, no invisible full-screen overlay div.
 * Keyboard: Enter/Space/↓ opens, ↑ ↓ Home End move, type-ahead, Esc closes and returns focus, Tab closes.
 */
export function MenuButton(props: MenuButtonProps) {
  const { entries, align = 'start', className } = props;
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(false);
  // Light-dismiss closes the popover on pointerdown, before our click handler runs: remember it was open.
  const wasOpenOnPointerDown = useRef(false);
  const typeahead = useRef({ text: '', timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const [open, setOpen] = useState(false);

  const items = useCallback(
    // Only items that are visible (the phone-only "Cancel" item is display:none on desktop).
    () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []).filter(
        (el) => el.getClientRects().length > 0,
      ),
    [],
  );

  const openMenu = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    showPopoverSafe(panel);
  }, []);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    returnFocus.current = restoreFocus;
    if (panelRef.current) hidePopoverSafe(panelRef.current);
  }, []);

  // Sync React state with the browser's popover state (Esc, outside click, our own calls).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onToggle = (e: Event) => {
      const next = (e as Event & { newState?: string }).newState;
      const isOpen = next === 'open';
      setOpen(isOpen);
      if (!isOpen && returnFocus.current) {
        triggerRef.current?.focus();
        returnFocus.current = false;
      }
    };
    panel.addEventListener('toggle', onToggle);
    return () => panel.removeEventListener('toggle', onToggle);
  }, []);

  // Place the panel next to the trigger once it is showing, then move focus into it.
  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!panel || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    panel.style.minWidth = `${Math.max(220, Math.round(rect.width))}px`;
    placeFixed(panel, rect, { side: 'bottom', align, gap: 4 });
    items()[0]?.focus();
  }, [open, align, items]);

  // Stale position on scroll or resize: just close.
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === 'scroll' && panelRef.current?.contains(e.target as Node)) return;
      closeMenu(false);
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open, closeMenu]);

  const focusAt = (list: HTMLElement[], i: number) => list[(i + list.length) % list.length]?.focus();

  const onPanelKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = items();
    const idx = list.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusAt(list, idx + 1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        focusAt(list, idx - 1);
        return;
      case 'Home':
        e.preventDefault();
        focusAt(list, 0);
        return;
      case 'End':
        e.preventDefault();
        focusAt(list, list.length - 1);
        return;
      case 'Escape':
        returnFocus.current = true; // browser closes the popover on Esc; we return focus on toggle
        return;
      case 'Tab':
        returnFocus.current = false;
        closeMenu(false);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = typeahead.current;
      clearTimeout(t.timer);
      t.text += e.key.toLowerCase();
      t.timer = setTimeout(() => (t.text = ''), 600);
      const start = idx + 1;
      const ordered = [...list.slice(start), ...list.slice(0, start)];
      const match = ordered.find((el) => el.textContent?.trim().toLowerCase().startsWith(t.text));
      match?.focus();
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu();
    }
  };

  const triggerCommon = {
    ref: triggerRef,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': panelId,
    onPointerDown: () => {
      wasOpenOnPointerDown.current = open;
    },
    onClick: () => {
      if (wasOpenOnPointerDown.current) {
        wasOpenOnPointerDown.current = false;
        triggerRef.current?.focus();
        return;
      }
      if (open) closeMenu(true);
      else openMenu();
    },
    onKeyDown: onTriggerKeyDown,
  };

  return (
    <>
      {props.trigger === 'icon' ? (
        <IconButton
          {...triggerCommon}
          label={props.label}
          icon={props.icon ?? Ellipsis}
          variant={props.variant ?? 'ghost'}
          size={props.size ?? 'sm'}
          className={className}
        />
      ) : (
        <Button
          {...triggerCommon}
          variant={props.variant ?? 'secondary'}
          size={props.size ?? 'md'}
          icon={props.icon}
          iconEnd={ChevronDown}
          className={className}
        >
          {props.label}
        </Button>
      )}
      <div
        ref={panelRef}
        id={panelId}
        role="menu"
        aria-label={props.label}
        popover="auto"
        className="menu-panel"
        onKeyDown={onPanelKeyDown}
      >
        <MenuItems entries={entries} onSelectEntry={(run) => { closeMenu(true); run(); }} />
        <button type="button" role="menuitem" tabIndex={-1} className="menu-item menu-cancel" onClick={() => closeMenu(true)}>
          <span className="menu-item-text">Cancel</span>
        </button>
      </div>
    </>
  );
}

/** The entries of a menu. Also used by the gallery to draw an "open" menu without the popover. */
export function MenuItems({ entries, onSelectEntry }: { entries: MenuEntry[]; onSelectEntry: (run: () => void) => void }) {
  return (
    <>
      {entries.map((entry, i) => {
        if (entry.type === 'separator') return <div key={i} role="separator" className="menu-sep" />;
        if (entry.type === 'group')
          return (
            <div key={i} role="presentation" className="menu-group-label">
              {entry.label}
            </div>
          );
        const Icon = entry.icon;
        const disabled = Boolean(entry.disabledReason);
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-disabled={disabled || undefined}
            data-destructive={entry.destructive ? 'true' : undefined}
            className="menu-item"
            onClick={() => {
              if (disabled) return;
              onSelectEntry(entry.onSelect);
            }}
          >
            {Icon && <Icon className="menu-item-icon" size={16} strokeWidth={1.75} aria-hidden="true" />}
            <span className="menu-item-text">
              {entry.label}
              {(entry.disabledReason || entry.description) && (
                <span className="menu-item-desc">{entry.disabledReason ?? entry.description}</span>
              )}
            </span>
            {entry.shortcut && <span className="menu-item-shortcut">{entry.shortcut}</span>}
          </button>
        );
      })}
    </>
  );
}
