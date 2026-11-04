import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Overview } from '@/components/overview/Overview';
import { Skeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = { title: 'Overview' };

/** Overview (plan §4.2): "What did I pay lately, and is it going up?" */
export default function Home() {
  // useSearchParams needs a Suspense boundary for the static build.
  return (
    <Suspense fallback={<Skeleton height={520} label="Loading" />}>
      <Overview />
    </Suspense>
  );
}
