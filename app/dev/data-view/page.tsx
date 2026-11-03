import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DataViewDemo } from '@/components/dev/DataViewDemo';

export const metadata: Metadata = { title: 'Data view demo (dev)', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** Development-only (404 in production). Throwaway demo for the shared chart/table toolbar; deleted after Phase 4a. */
export default function DataViewDemoPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DataViewDemo />;
}
