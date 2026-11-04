import type { Metadata } from 'next';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const metadata: Metadata = { title: 'Page not found' };

/** Unknown address: same calm page as the error one, one way back (plan §4.10). */
export default function NotFound() {
  return (
    <main id="content" className="flex min-h-screen items-center justify-center p-4">
      <div className="flex max-w-[480px] flex-col items-center gap-3 text-center">
        <SearchX size={28} strokeWidth={1.75} aria-hidden="true" className="text-ink-muted" />
        <h1 className="text-[22px] leading-8 font-semibold">Page not found</h1>
        <p className="text-[14px] leading-5 text-ink-muted">There is nothing at this address. Use Overview to find your way back.</p>
        <div className="mt-2">
          <Button variant="primary" size="lg" href="/">Go to Overview</Button>
        </div>
      </div>
    </main>
  );
}
