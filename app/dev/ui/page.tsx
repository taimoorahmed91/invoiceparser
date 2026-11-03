import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Gallery } from '@/components/dev/Gallery';

export const metadata: Metadata = {
  title: 'UI gallery (dev)',
  robots: { index: false, follow: false },
};

// Decide per request, never at build time.
export const dynamic = 'force-dynamic';

/**
 * Development-only component gallery (plan §2.7.11).
 * Lives outside the (app) group so it loads no providers and never touches Supabase.
 * Production builds answer 404.
 */
export default function UiGalleryPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Gallery />;
}
