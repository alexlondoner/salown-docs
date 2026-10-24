# HANDOFF — ABANDONED-CART-DASHBOARD-BOOKING-ID ("Send 'Finish your booking'") · state at 2026-10-24 ~17:45 Europe/London

**Status: DONE.** R-2026-10-24-A live, DEPLOYED_VERIFIED + OBSERVED_CLEAN (15 min) + OWNER_VERIFIED. Only the main twin is left
(to be done in the single ONLINE-EXTRAS + abandoned-cart main-integration session, §5).

Owner rules that still apply:
- No production change without the owner's exact, Europe/London-date-bound approval lines. Never invent an APPROVAL_ID.
- Any difference → STOP. Rollback needs its own approval line.
- Never call `sendAbandonedCart` (or any email callable) from a session; the owner presses the button, the session reads logs.

## 1. The bug
- Panel → BookingDetailPanel → "Send 'Finish your booking'" answered `Not sent · booking_not_found` for every PENDING booking
  opened from Dashboard / Bookings.
- Cause: K4 (SEC-PUBLIC-EMAIL-SENDER, R-2026-10-02) made `sendAbandonedCart` resolve the booking server-side under the
  claim tenant. The panel sent no id, only date/time/email, and Dashboard/Bookings pass **display** values ("22 October 2026",
  "6:35 PM") that never equal the stored "2026-10-22" / "18:35" → exact fallback match found nothing → refused before Brevo.
- **Not** the Brevo key rotation (the refusal happens before any send).

## 2. The fix (hosting only, no function change)
- `src/utils/abandonedCartRequest.ts` — builds the request; adds `bookingId = booking.bookingDocId` (canonical Firestore doc
  id, validated with the server's own `DOC_ID_RE`). Never sends the display `bookingId` or `id`. A shape without
  `bookingDocId` (notification-bell path) keeps the old body byte-for-byte.
- `src/components/BookingDetailPanel.tsx` — one import + one hunk calling the helper.
- Tests: `src/utils/abandonedCartRequest.test.ts` (12), `ops/releases/abandoned-cart-docid/server-contract.cjs` (11 cases
  against the live module, sha `ae8f16f9…`), `mutate.py` (10/10 killed).
- Email callsite audit: reminder + cancellation already send `bookingId`; loyalty adjustment = client email lookup; receipt
  = content only. Nothing else had this bug.

## 3. What is LIVE

| Release | What | Live | Rollback target |
|---|---|---|---|
| R-2026-10-24-A | ABANDONED-CART-DOCID hosting `8e30897d` (tree `0b4f7d82`, parent = live source `afa54daa`) | hosting:salown `f544310dfadb6d8f` (2026-10-24T13:58:12Z) | `29e1dbb95722adcc` — `rollback-site.sh HOSTING --rollback`, approval `ABANDONED-CART-DOCID-HOSTING-ROLLBACK-<date>` |

- Unchanged: `sendAbandonedCart` `-00016-raf` (gen 1792517282814496), salown-staff `c80748a54239a527`.
- OWNER_VERIFIED 2026-10-24 ~17:29 BST: owner pressed the button on a pending booking, email arrived. Logs: two calls
  16:29:06Z / 16:29:21Z, HTTP 200, callable verification passed, 0 errors.

## 4. History / lineage
- First cut `8fa8aac5` on `b889c195` (2026-10-22) — void after ONLINE-EXTRAS-P3 hosting landed.
- Recut `8e30897d` on `afa54daa` (2026-10-23, by the ONLINE-EXTRAS session, then handed back); patch-id `cfa75cdb` == first cut.
- 2026-10-23 approval expired unused (23:43 BST, gates would cross midnight). Fresh check-only 2026-10-24 00:25 BST → approval.
- Branches on origin (kept): `release/abandoned-cart-docid-on-live-b889c195` (void), `release/abandoned-cart-docid-on-live-afa54daa` (live).
- Kit + evidence: `~/release-work/abandoned-cart-docid/kit` (`runs-deploy-24.out`, `runs/site-HOSTING-deploy-20261024T135233Z`,
  `runs/monitor-24.out`; `runs/site-HOSTING-check-only-20261023T184537Z` is marked NOT-EVIDENCE).
- Records: ledger R-2026-10-24-A; salown-app SYNC `923c2e0e`; claim `ABANDONED-CART-DASHBOARD-BOOKING-ID` → done.

## 5. Left: main twin (in the single main-integration session)
- Port the 6 paths of `8e30897d` onto main together with the ONLINE-EXTRAS main twin. They do not overlap the
  ONLINE-EXTRAS paths (`bookingAddOnLines*` etc.); cherry-pick should be clean, but re-run the 12 request tests + the
  wiring tests on main (Dashboard/Bookings must still set `bookingDocId`).
- Main twin must not trigger a hosting deploy except under its own approval (push to main = CI hosting deploy).
