'use client';

import { fmtDelta, fmtMoney } from '@/lib/format';
import type { Breakdown } from '@/lib/analyticsOverview';

/**
 * This month by item (plan §4.2): ranked list with amount and the change against the previous month that has data.
 * The rows add up to the month total shown on the Total card and the chart bar. Utility rows carry the invoice's own Polish wording.
 */
export function ItemBreakdown({ data }: { data: Breakdown }) {
  return (
    <section className="ov-card" aria-labelledby="ov-items-title">
      <div>
        <h2 className="ov-card-title" id="ov-items-title">This month by item</h2>
        <p className="ov-card-sub">
          {data.month}
          {data.previousMonth ? ` · change vs ${data.previousMonth}` : ' · first month with data'}
        </p>
      </div>
      {data.rows.length === 0 ? (
        <p className="ov-note">No amounts on this month’s invoices.</p>
      ) : (
        <ul className="ov-items">
          {data.rows.map((r) => {
            const d = r.previous === null ? null : fmtDelta(r.amount, r.previous);
            const share = data.total > 0 ? Math.max(2, Math.min(100, (r.amount / data.total) * 100)) : 0;
            return (
              <li key={r.key} className="ov-item" data-item={r.key}>
                <span className="ov-item-name">
                  <span className="ov-item-dot" style={{ background: r.color }} aria-hidden="true" />
                  <span className="ov-item-text">
                    <span className="ov-item-label">{r.label}</span>
                    {r.polish && <span className="ov-item-pl" lang="pl">{r.polish}</span>}
                  </span>
                </span>
                <span className="ov-item-amount">{fmtMoney(r.amount)}</span>
                <span className="ov-item-delta">
                  <small data-dir={d?.direction ?? 'none'}>{d ? (d.direction === 'flat' ? '— no change' : d.text) : ''}</small>
                  <span className="ov-bar" aria-hidden="true">
                    <span style={{ width: `${share}%`, background: r.color }} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="ov-items-total">
        <span>Total</span>
        <span>{fmtMoney(data.total)}</span>
      </div>
      {data.manual && (
        <p className="ov-note">
          Manual heating value set for this month: {data.manual.units} × 76 = {fmtMoney(data.manual.amount)}. Central Heating is shown as on the invoice, the same as in Analytics.
        </p>
      )}
    </section>
  );
}
