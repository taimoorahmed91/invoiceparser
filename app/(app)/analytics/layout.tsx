import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The page itself is a client component (it reads the URL), so its title is set here.
export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return children;
}
