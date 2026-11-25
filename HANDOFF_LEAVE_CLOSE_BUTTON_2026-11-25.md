# HANDOFF — LEAVE-CLOSE-BUTTON (2026-11-25)

**Status:** fix committed LOCALLY, not pushed, not released. No release candidate prepared.
**Where:** worktree `~/release-work/leave-close-fix-20261125`, branch `work/leave-close-button`, commit `9ed6592f` on `origin/main c398ebf3`.
**Claim:** `ops/claims/LEAVE-CLOSE-BUTTON--alish--leave-close-button.claim` pushed to main as `36e4a9d8` (`status: working`). Locks `src/pages/Barbers.tsx` + the new test. **Close it (status: done / delete) when the fix lands or is abandoned.**

## Root cause
`submitLeave` (src/pages/Barbers.tsx) set `leaveInFlightRef = true` and reset it only for the local `invalid` outcome. After `applied` / `settled` / `refused` / `verification_required` the busy STATE cleared (Close button enabled) but the REF stayed `true`, so `closeLeaveSheet()` returned early. One ref was doing two jobs: "a request is out" and "this attempt is spent".

## Fix (one file)
- REQUEST lock `leaveInFlightRef`: set before the first `await`, released in `finally` the moment the request settles. `closeLeaveSheet` blocks only while it is true (button, Escape, backdrop).
- ATTEMPT consumption (unchanged contract): `leaveAttemptRef` (idempotency key) dropped after any outcome except local `invalid`, plus `leaveResult` guard. `submitLeave` still returns on `!key` / `leaveResult`, so freeing the request lock cannot open a second write.
- `submitLeaveOperation` throwing (contract says never): treated as consumed -> `verification_required` result with `UNEXPECTED_CLIENT_ERROR`, no resend.
- `fetchBarbers()` after a write wrapped in try/catch: a failed refresh cannot lock the sheet or look like a failed write.
- Not touched: functions, rules, Finance / Paid leave, shift dates, other lifecycle sheets (offboard/rehire have the same pattern — NOT audited here).

## Tests
`src/pages/Barbers.leaveClose.render.test.tsx` — real `Barbers` component, mocked firebase + `submitLeaveOperation`. 8 tests: success; double-click + Close/Escape while in flight; settled / refused / verification_required; invalid -> Close -> reopen -> send; unexpected throw; write ok + refresh fails. All 8 FAIL on the unfixed file, pass on the fix.
Also: 7 related source-guard suites 293/293 pass; Admin `vite build` OK.
Pre-existing, unrelated (identical on unfixed main): `eslint` `rehireRota` unused-var at Barbers.tsx:349; `staffLifecycle.test.ts` 10 fail (needs built `functions/lib/staff/lifecycleRehire.js`).

## Open
- Release: none prepared. Needs owner approval, own claim lifecycle, Admin hosting deploy from live lineage (live Admin `3ad05c03`, source `61d9b54a`) — not main.
- Same single-ref pattern probably exists in the offboard / rehire / availability-until sheets: audit separately.
- `fetchBarbers` swallows errors and sets `barbers=[]` (pre-existing; empties the list on a failed refresh).
- Manual browser check of the real leave flow not done (no live write was allowed).
