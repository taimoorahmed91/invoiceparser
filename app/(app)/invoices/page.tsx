import { Suspense } from 'react';
import { InvoicesPage } from '@/components/invoices/InvoicesPage';
import { Skeleton } from '@/components/ui/Skeleton';

// The page reads ?invoice= (the open drawer) from the URL, which needs a Suspense boundary while the page is prerendered.
export default function Page() {
  return (
    <Suspense fallback={<div className="inv-page" aria-busy="true"><Skeleton height={140} label="Loading filters" /></div>}>
      <InvoicesPage />
    </Suspense>
  );
}
