'use client';

import { Tabs, type TabItem } from '@/components/ui/Tabs';

export type AnalyticsTab = 'monthly' | 'utilities' | 'yoy';

/** Tabs of the Analytics page. Utilities and Year over year arrive in Phase 4b / 4c; until then they are visible but unavailable. */
export const ANALYTICS_TABS: TabItem<AnalyticsTab>[] = [
  { id: 'monthly', label: 'Monthly costs' },
  { id: 'utilities', label: 'Utilities', disabledReason: 'Utilities charts are coming in the next update' },
  { id: 'yoy', label: 'Year over year', disabledReason: 'Year over year is coming in a later update' },
];

/** ?tab= → a tab that can be opened (unknown or unavailable values fall back to Monthly costs). */
export function parseTab(param: string | null | undefined, tabs: TabItem<AnalyticsTab>[] = ANALYTICS_TABS): AnalyticsTab {
  const t = tabs.find((x) => x.id === param);
  return t && !t.disabledReason ? t.id : 'monthly';
}

export function AnalyticsTabs({ value, onChange }: { value: AnalyticsTab; onChange: (t: AnalyticsTab) => void }) {
  return <Tabs<AnalyticsTab> idBase="analytics" aria-label="Analytics sections" tabs={ANALYTICS_TABS} value={value} onChange={onChange} />;
}
