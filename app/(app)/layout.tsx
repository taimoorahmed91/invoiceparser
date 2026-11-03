import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';

/**
 * Everything inside the app shell. Phase 3 adds the data providers here
 * (InvoicesProvider, ManualValuesProvider) so state survives navigation.
 * The /dev/ui gallery is deliberately outside this group (no shell, no data).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
