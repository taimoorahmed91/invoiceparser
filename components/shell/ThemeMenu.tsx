'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { MenuButton, type MenuEntry } from '@/components/ui/MenuButton';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/lib/theme';

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

export function useThemeEntries(): { entries: MenuEntry[]; current: (typeof OPTIONS)[number] } {
  const { preference, setPreference } = useTheme();
  const entries: MenuEntry[] = OPTIONS.map((o) => ({
    label: o.label,
    icon: o.icon,
    // text, not colour, marks the current choice
    shortcut: o.value === preference ? 'Selected' : undefined,
    onSelect: () => setPreference(o.value),
  }));
  return { entries, current: OPTIONS.find((o) => o.value === preference) ?? OPTIONS[0] };
}

/** Theme control for the sidebar (labelled button) and the rail (icon button with a name). */
export function ThemeMenu({ variant }: { variant: 'full' | 'icon' }) {
  const { entries, current } = useThemeEntries();
  if (variant === 'icon') {
    return <MenuButton trigger="icon" label={`Theme: ${current.label}`} icon={current.icon} size="md" entries={[{ type: 'group', label: 'Theme' }, ...entries]} />;
  }
  return <MenuButton label={`Theme: ${current.label}`} icon={current.icon} variant="ghost" size="md" entries={[{ type: 'group', label: 'Theme' }, ...entries]} />;
}
