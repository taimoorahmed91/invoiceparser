import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { InvoicesProvider } from '@/hooks/useInvoices';
import { ManualValuesProvider } from '@/hooks/useManualValues';
import { UploadProvider } from '@/components/upload/UploadProvider';

/**
 * Shared providers live above the shell so data survives route navigation.
 * The /dev/ui gallery is deliberately outside this group (no shell, no data).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <InvoicesProvider><ManualValuesProvider><UploadProvider><AppShell>{children}</AppShell></UploadProvider></ManualValuesProvider></InvoicesProvider>;
}
