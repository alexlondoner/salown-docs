# FIN-FEES prototype — screenshots (2026-09-14)

Captured from the local prototype [`docs/prototypes/fin-fees/`](../../../prototypes/fin-fees/) served briefly on
`127.0.0.1:5288` (port verified free first; server stopped afterwards). **Synthetic data only** — no account, no Firebase,
no Stripe, no production read. Light theme, 1568×755 viewport, fee-day assumption = **service day** (an undecided
assumption, not a decision). Design notes **off** except in `6-…`.

These replace the screenshots taken earlier the same day on port 5199, which were used for visual checking only and were
**not saved** to disk. Those earlier ones also showed development notes mixed into the product copy; that has since been
separated into a switchable "DESIGN NOTE" layer.

| File | Screen | Query |
|---|---|---|
| `1a-daily-ledger-overview-top.jpg` | P&L waterfall with Stripe fee coverage, review strip, cash / bank / Stripe cards | `?month=2026-09&tab=daily&fee=service` |
| `1b-daily-ledger-table.jpg` | Daily Ledger: Stripe fee column (confirmed / awaiting Stripe / no record), "up to" nets, coverage footer | `…&focus=ledger` |
| `2-fee-states-confirmed-awaiting-no-record.jpg` | W-01 fee confirmed · W-03 awaiting Stripe · W-04 no fee record | `?month=2026-09&tab=online&only=W-01,W-03,W-04&focus=tabs` |
| `3-refunds-partial-and-full.jpg` | W-06 partly refunded after checkout · W-07 cancelled and refunded; Stripe keeps its fee | `…&only=W-06,W-07&focus=tabs` |
| `4a-second-capture-review-strip.jpg` | Review strip incl. "Charged twice" and the Stripe card's duplicate-charge line | `…&only=W-08&focus=review` |
| `4b-second-capture-card.jpg` | W-08 card: charge 1 + duplicate charge 2 | `…&only=W-08&focus=tabs` |
| `5-closed-month-later-refund.jpg` | August 2026 closed: stored figures, "no fee record" payments, refund after closing not added | `?month=2026-08&tab=daily` |
| `6-design-notes-layer-on.jpg` | Same as 3 with design notes on, showing the separate note layer | `…&only=W-06,W-07&focus=tabs&notes=1` |

The dark bar at the top of every image is prototype chrome, not product. `only` and `focus` are review aids.
