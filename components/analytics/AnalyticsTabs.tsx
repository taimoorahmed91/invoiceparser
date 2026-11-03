'use client';

import { Tabs, type TabItem } from '@/components/ui/Tabs';

export type AnalyticsTab = 'monthly' | 'utilities' | 'yoy';

/** Tabs of the Analytics page. */
export const ANALYTICS_TABS: TabItem<AnalyticsTab>[] = [
  { id: 'monthly', label: 'Monthly costs' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'yoy', label: 'Year over year' },
];

/** ?tab= → a tab that can be opened (unknown or unavailable values fall back to Monthly costs). */
export function parseTab(param: string | null | undefined, tabs: TabItem<AnalyticsTab>[] = ANALYTICS_TABS): AnalyticsTab {
  const t = tabs.find((x) => x.id === param);
  return t && !t.disabledReason ? t.id : 'monthly';
}

export function AnalyticsTabs({ value, onChange }: { value: AnalyticsTab; onChange: (t: AnalyticsTab) => void }) {
  return <Tabs<AnalyticsTab> idBase="analytics" aria-label="Analytics sections" tabs={ANALYTICS_TABS} value={value} onChange={onChange} />;
}
