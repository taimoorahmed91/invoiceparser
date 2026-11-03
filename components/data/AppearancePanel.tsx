'use client';

import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/toast/ToastProvider';
import { resetChartPrefs } from '@/hooks/useChartPrefs';
import { useTheme } from '@/hooks/useTheme';
import { useUiPrefs } from '@/hooks/useUiPrefs';
import type { Density } from '@/lib/uiPrefs';
import type { ThemePreference } from '@/lib/theme';

/** Appearance (plan §4.8 item 4): theme, table density, and the reset for every remembered Chart | Table and chart-type choice. */
export function AppearancePanel() {
  const { preference, setPreference } = useTheme();
  const { prefs, update } = useUiPrefs();
  const toast = useToast();

  return (
    <div className="dt-card">
      <div>
        <h2 className="dt-title" id="appearance-title">Appearance</h2>
        <p className="dt-desc">These settings are kept in this browser only.</p>
      </div>

      <div className="dt-group">
        <h3 className="dt-sub" id="theme-label">Theme</h3>
        <SegmentedControl<ThemePreference>
          aria-labelledby="theme-label"
          size="md"
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'system', label: 'System', icon: Monitor },
            { value: 'light', label: 'Light', icon: Sun },
            { value: 'dark', label: 'Dark', icon: Moon },
          ]}
        />
        <p className="dt-hint">System follows your device. The choice applies right away.</p>
      </div>

      <div className="dt-group">
        <h3 className="dt-sub" id="density-label">Table density</h3>
        <SegmentedControl<Density>
          aria-labelledby="density-label"
          size="md"
          value={prefs.density}
          onChange={(density) => update({ density })}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
        />
        <p className="dt-hint">Comfortable rows are 52 px high, compact rows 40 px. It applies to every table.</p>
      </div>

      <div className="dt-group">
        <h3 className="dt-sub">Charts and tables</h3>
        <p className="dt-hint">Each chart remembers whether you last looked at the chart or the table, and which chart type you chose.</p>
        <div className="dt-actions">
          <Button
            variant="secondary"
            icon={RotateCcw}
            onClick={() => {
              resetChartPrefs();
              toast.success('Chart and table choices are back to their defaults');
            }}
          >
            Reset all chart/table view choices
          </Button>
        </div>
      </div>
    </div>
  );
}
