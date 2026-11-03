import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { InvoicesProvider } from '@/hooks/useInvoices';
import { ManualValuesProvider } from '@/hooks/useManualValues';

/**
 * Shared providers live above the shell so data survives route navigation.
 * The /dev/ui gallery is deliberately outside this group (no shell, no data).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <InvoicesProvider><ManualValuesProvider><AppShell>{children}</AppShell></ManualValuesProvider></InvoicesProvider>;
}
