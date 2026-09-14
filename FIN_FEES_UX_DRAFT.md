# FIN_FEES_UX_DRAFT.md — how Finance could show processor fees (B2), and which day a fee belongs to

> **Status: DRAFT for owner decision (2026-09-14). Not approved, no code written, nothing released.**
> Work IDs: `FIN-PROCESSOR-FEES` B1b / B2 (`PROCESSOR_FEES_PLAN.md` §8–§9). Evidence of the current state:
> `evidence/fin-processor-fees/2026-09-14-status-audit.md`.
> **Existing design searched first:** no mockup, design handoff or component for fee display exists (grep over `docs/`,
> `design_handoff_*`, `salown-app/src`, the served Admin bundle). This page is therefore a first sketch placed on the
> **current** Finance screen, not a redesign.

---

## 1 · Constraints this sketch must respect

1. **Gross never moves** (`PROCESSOR_FEES_PLAN.md` §1.3, test T4). The fee is a cost line under *Expenses & Fees*;
   `effectiveRevenue`, `online_p` and every revenue figure stay byte-identical.
2. **Unknown is not zero.** A payment whose fee is not recorded yet shows as *pending* or *not recorded*, counted, never £0.
3. **`FINANCE_REDESIGN_GUARDRAILS.md`** ("same numbers, same buttons") governs restyling. B2 is a deliberate formula change
   to Net Revenue, Net P&L and Bank Balance, so it needs explicit owner approval and a parity test that shows exactly which
   figures move and by how much, per month.
4. **Closed months are not restated** (`FIN-PERIOD-CLOSE`). A stored month keeps its combined expense line; late fee or
   refund facts for a closed month land in the first open month with a label.
5. **Finance is whitecross-only, owner / super-admin** (`Sidebar.tsx:248`). Provider names are allowed here; Reports stays
   provider-neutral (B4).
6. Nothing here exists until B1 has written real entries. B2 without B1 would render only "not recorded".

## 2 · Where it would appear on today's screen

### 2.1 P&L breakdown — the existing "− Expenses & Fees" block (`Finance.tsx` ~1838)

Today: Cash expenses · Bank expenses · Treatwell fees (only when > 0) · **Net Revenue**.

```
− EXPENSES & FEES                                   Sep 2026
  Cash expenses                                     −£412.00
  Bank expenses                                     −£236.50
  Treatwell fees                                     −£18.90
  Stripe fees (website)                              −£14.62   actual · 18 payments
    ⚠ fee not recorded yet                             3 payments   ← muted, no £ added
  ───────────────────────────────────────────────────────────
  Net Revenue                                      £3,121.48
```

- `actual` / `estimate` shown as a small tag; an estimate is only possible after B5 (`railFees`).
- The "not recorded" line has a count and a tooltip ("Stripe has not priced these yet, or they were paid before fee
  tracking started on <START date>"). It adds nothing to the total.

### 2.2 Bank Balance card (`Finance.tsx` ~1946)

Today it adds **Online (prepaid) revenue** at gross, as if it were already in the bank.

```
🏦 BANK BALANCE
  Card/Monzo revenue                         +£2,480.00
  Online via Stripe (gross)                    +£731.00
    − Stripe fees                               −£14.62
    = Online net                               +£716.38   ⓘ reaches the bank on Stripe's payout
  Bank expenses (paid)                         −£236.50
  Bank payments                                −£900.00
  Treatwell commission                          −£18.90
  Fixed costs (accrued)                        −£360.00
```

Payout timing (money "in transit" in Stripe) is **not** shown in B2: nothing reads payouts yet. The ⓘ says so instead
of implying the money has arrived.

### 2.3 Daily Ledger table (`Finance.tsx` ~2055)

Keep the existing **Online prepaid** column (gross). Add one narrow column next to it, shown only when the period has online
money:

```
Date   … | Online prepaid | Online fee      | Cash Exp. | …
05 Sep   |   £32.00       | −£0.68          |           |
06 Sep   |   £40.00       | pending         |           |
07 Sep   |   £28.00       | not recorded ⓘ  |           |
```

### 2.4 Review strip (top of Finance, only when non-empty)

```
⚠ 2 payments need review — 1 charged twice (second capture) · 1 refund after checkout      [View]
```

Sources: `paymentNeedsReview` / `multipleCharges` from B1, `CANONICAL_BASE_MISMATCH` count (already computed, never shown).
No button spends money; resolution uses the existing refund actuator or a compensating entry.

### 2.5 Booking detail panel (`BookingDetailPanel.tsx` ~1761, where the Treatwell fee row already is)

```
Paid online (Stripe)      £40.00
Stripe fee                −£0.95   actual
Refunded                  −£10.00  06 Oct
Salon net on this rail     £29.05
```

### 2.6 States every surface must render the same way

| State | Condition (B1 projection) | Display |
|---|---|---|
| actual | `feeSource: 'actual'`, fee covers every capture | amount |
| estimate | `feeSource: 'estimate'` (B5 only) | amount + `estimate` |
| pending | capture recorded, fee `null`, `settlementSync` pending | `pending` (sweeper runs every 15 min) |
| not recorded | booking paid before `WC_SETTLEMENT_START_ISO`, no entries | `not recorded` + tooltip; B3 backfill would fill it |
| refunded | `refunded_m > 0` (needs **B1b**) | refund line; fee stays (Stripe keeps it) |
| second capture | `multipleCharges: true` | review strip |

## 3 · Which day does a fee belong to? — worked example

One website booking, full payment. **All amounts are illustrative** (not Stripe's price list); **dates are chosen to
cross a month boundary** so the options differ.

| Event | Date | Money |
|---|---|---|
| Customer pays £40 on the website | **29 Sep** | Stripe charge £40.00, Stripe fee £0.80 (illustrative) |
| Stripe pays the net out to the bank | **2 Oct** | +£39.20 inside a payout batch |
| Service delivered, checked out | **3 Oct** | revenue £40.00 (Finance already books revenue on the service day) |
| Partial refund after a complaint | **6 Oct** | −£10.00; Stripe does **not** return the £0.80 fee |
| Refund deducted from the next payout | **8 Oct** | −£10.00 inside another batch |

Finance revenue is already service-day, so **£40 revenue is in October under every option**. The options differ only in
where the fee and the refund land:

| | A · Service day (recommended by the plan) | B · Payment day | C · Refund day (for refunds) | D · Payout day (cash) |
|---|---|---|---|---|
| **Fee £0.80** | October (3 Oct row) | **September** (29 Sep) | — (question is about refunds) | inside the 2 Oct payout, not itemised |
| **Refund £10** | October (the sale it belongs to) | payment-day logic has no answer; falls back to refund day 6 Oct | 6 Oct | 8 Oct payout |
| **September Net Revenue** | £0 | **−£0.80**: a cost with no sale | £0 | £0 |
| **October Net Revenue** | £40 − £0.80 − £10 = **£29.20** | £40 − £10 = £30.00 (fee is missing from the month that earned it) | £29.20 if the fee is on the service day | revenue £40, costs arrive as bank movements, not per sale |
| **Daily Ledger** | fee and refund on the 3 Oct row | fee on 29 Sep, a day with no service | refund on 6 Oct | nothing per booking; 2 Oct / 8 Oct bank rows |
| **Bank Balance** | unchanged by the choice — needs payout data to be truthful | same | same | matches the bank statement, but only once payouts are recorded (not in B1) |
| **When October is already closed** | the refund must move to the first open month, labelled | fee already in September; refund same issue | naturally in the open month | naturally in the open month |

**What each option is good for.**
- **A** keeps a sale and its costs on one row: margin per day and per month is right, and it matches how Finance already
  books revenue. Weakness: late facts (a refund in November for an October sale) need the closed-month rule.
- **B** matches the Stripe dashboard's day, but splits a sale from its cost whenever payment and service fall in different
  periods. Deposits paid weeks ahead make that common.
- **C** is the only option that answers a refund cleanly after a month is closed, so it works as a **fallback for refunds**,
  not as the fee rule.
- **D** is the bank's view. It is the right basis for **reconciling the bank**, not for P&L. It needs payout records that
  no writer produces yet.

**Recommended split for the owner to confirm:** fees on the **service day** (A); refunds on the **service day while that
month is open, otherwise the refund day in the first open month** (A with C as fallback); bank reconciliation on the
**payout arrival day** (D) as a separate view once payouts are recorded.

**A case the plan does not settle yet — decide it with this choice.** A booking that is paid, then **cancelled and fully
refunded, never checked out**, has no service day and no revenue, but Stripe still keeps the fee. With automatic refunds
switched on this becomes routine. Proposal: book that fee on the **cancellation / refund day**, as a stand-alone cost line
"Stripe fees on refunded bookings".

## 4 · Decisions needed before B2 is built

1. Fee day: A (service) or B (payment) — §3.
2. Refund day rule, including closed months — §3.
3. The cancelled-and-refunded fee case — §3.
4. Whether Bank Balance should show Online at net in B2 (§2.2) or wait for payout data.
5. Whether B3 (history backfill) should run before B2 ships, so the screen does not open with months of "not recorded".
