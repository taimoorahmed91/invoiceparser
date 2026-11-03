'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { SegmentedControl } from './SegmentedControl';
import { useTheme } from '@/hooks/useTheme';
import type { ThemePreference } from '@/lib/theme';

/** System | Light | Dark. Temporary home in the old page header until the shell (Phase 2) and Data → Appearance (Phase 6). */
export function ThemeSwitch({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl<ThemePreference>
      aria-label="Theme"
      size={size}
      value={preference}
      onChange={setPreference}
      options={[
        { value: 'system', label: 'System', icon: Monitor },
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
      ]}
    />
  );
}
