import type { Metadata } from 'next';
import { DataPage } from '@/components/data/DataPage';

export const metadata: Metadata = { title: 'Data & settings' };

/** Data & settings (plan §4.8): manual heating values, import / export, sync, appearance, shortcuts, danger zone. */
export default function Data() {
  return <DataPage />;
}
