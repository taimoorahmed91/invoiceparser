import { invoiceKinds } from '@/lib/invoiceList';
import type { StoredInvoice } from '@/lib/storage';

/** Type badge; the combined rent + parking invoice shows both (text, not colour alone). */
export function TypeBadge({ invoice }: { invoice: StoredInvoice }) {
  const kinds = invoiceKinds(invoice);
  return (
    <span className="tb-group">
      {kinds.map((k, i) => (
        <span key={k} className="tb-item">
          {i > 0 && <span className="tb-plus" aria-hidden="true">+</span>}
          <span className="tb" data-kind={k}>{k}</span>
        </span>
      ))}
    </span>
  );
}
