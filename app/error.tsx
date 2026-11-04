'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * The error page (plan §4.10, F47): what happened in plain words, the technical message for the curious, one main action.
 * Shown inside the root layout (theme and fonts apply), but outside the app shell, so it has its own <main> and h1.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // error boundaries cannot export metadata, so the tab title is set here
  useEffect(() => {
    document.title = 'Something went wrong · Invoice Parser';
  }, []);
  return (
    <main id="content" className="flex min-h-screen items-center justify-center p-4">
      <div className="flex max-w-[480px] flex-col items-center gap-3 text-center">
        <TriangleAlert size={28} strokeWidth={1.75} aria-hidden="true" className="text-danger" />
        <h1 className="text-[22px] leading-8 font-semibold">Something went wrong</h1>
        <p className="text-[14px] leading-5 text-ink-muted">
          The page hit a problem it could not recover from. Your invoices are stored in the database and are not affected.
        </p>
        {error.message && (
          <p className="max-w-full break-words rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-left font-mono text-[12px] leading-4 text-ink-muted">
            {error.message}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
          <Button variant="primary" size="lg" onClick={reset}>Try again</Button>
          <Button variant="link" href="/">Go to Overview</Button>
        </div>
      </div>
    </main>
  );
}
