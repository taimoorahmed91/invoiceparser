import { redirect } from 'next/navigation';

/** TEMPORARY (Phase 2): Overview is built in Phase 5. Until then the old dashboard lives at /invoices. */
export default function Home() {
  redirect('/invoices');
}
