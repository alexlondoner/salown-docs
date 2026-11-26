# HANDOFF — BOOKSY-SETTINGS-SAVE (2026-11-26) · LOCAL fix `f9286910`, NOT released

**Status:** `IN_PROGRESS` (local). Branch `work/booksy-settings-save`, worktree `~/release-work/booksy-settings-review-20261126/wt`, base = live Admin source `a7fb579f`. **No push of product code, no deploy, no mail, no live data read/written.** Claim `BOOKSY-SETTINGS-SAVE--alish--booksy-settings.claim` pushed to main (Settings.tsx + 3 new files), `working`. The parser candidate `36a03648` (BOOKSY-MULTISERVICE) is separate and stays release-blocked.

## 1. Bug — PROVEN (test red on unmodified source, green after)
Settings → Integrations → "Platform payment settings" edited only the React draft (`updatePlatform`). The Integrations Save branch wrote parser flags + Treatwell iCal and called `flash()`; **nothing wrote `settings.platforms`**, so a changed Booksy/Fresha/Treatwell `paymentType`/`depositAmount` showed "✓ Saved" and was lost on reload. Same in live Admin `a7fb579f`. (On unmodified source: 5 of 7 new tests fail, incl. "Saved" with no write.)
Second defect on the same field: `parseFloat(value)||0` silently turned an empty/invalid amount into £0.

## 2. Fix (only that)
- `src/utils/platformPaymentSettingsWrite.ts` (new): `buildPlatformPaymentPatch(baseline, draft)` → **owned-field patch** `{ platforms: { <p>: { paymentType?, depositAmount? } } }` of only what changed since load; `parseDepositAmount` strict (finite, ≥ 0, ≤ 2 decimals; never 0-by-default); `settledPlatforms`.
- `Settings.tsx`: baseline state set at load; Integrations Save validates first (invalid → error, **no write, no Saved**), writes the patch with `setDoc(..., {merge:true})` on `tenants/{tid}/settings/settings` (deep-merge: sibling platform fields, other platforms, loyalty/currency/unknown fields untouched), then the existing flag/iCal writes. A failed write → "Could not save settings.", baseline unchanged. Amount input holds the raw string (shows what was typed), stored as a number.
- Unchanged platforms are **not** written (screen defaults ≠ parser fallbacks, so untouched platforms must not materialise defaults). Reader contract (`platforms.<p>.paymentType/depositAmount`, read by dispatch/IMAP/manual import as `platformCfg`) unchanged.

## 3. Verification (targeted)
- `SettingsBooksyPlatformPayment.test.tsx` (real Settings component, in-memory Firestore): save+reopen amount; save+reopen type; **only changed fields written**; Fresha/Treatwell/loyalty/currency/unknown fields preserved; failed write → no Saved, doc unchanged; `''`/`-5`/`abc` refused, no write; untouched save writes no platforms; parser-flag write still happens. + `platformPaymentSettingsWrite.test.ts` helper tests. Neighbours `SettingsSpecialHours`, `settingsDisclosure`: **87/87 pass**.
- eslint on touched files: clean. `npm run build` (Admin): OK. `tsc --noEmit`: 52 errors both before and after (all pre-existing/environmental — missing `@types/node`, unbuilt `functions/lib`; incl. one existing `Settings.tsx:693`); none new.
- Test-harness note: `jsdom@29.1.1`, `@testing-library/react@16.3.3`, `@testing-library/dom@10.4.2` are NOT in `package.json`; installed with `--no-save` in the worktree (same versions as the earlier harness). Existing `SettingsSpecialHours` test needs them too.
- Not run: full suite, emulator, signed-in browser. **Do not test by changing whitecross's real settings.**

## 4. Read-only: where does the setting reach a booking? (multi-service parser)
- **Applied at IMPORT time, once per booking:** `functions/src/parsers/booksy.ts` payload IIFE reads `platformCfg.booksy` (loaded by the dispatch/IMAP/manual paths from `settings.platforms`) → writes `paidAmount`/`platformDepositAmount`/`paymentType` onto the booking (`deposit` → configured amount, fallback 10; `prepaid` → that booking's price; else 0). Stored values are not touched when settings change later.
- **No per-service contract exists in code.** The config is per platform: one `paymentType` + one `depositAmount`, applied once per booking. Whether Booksy takes the deposit per service is an **assumption** (owner/Booksy still to confirm); `min(deposit, line)` is a hypothesis only. This round changed no payment calculation.
- **Setting changes CAN reach old bookings through readers** (not through storage): `readPlatformDepositSummary` uses `own>0 ? booking.platformDepositAmount : <current config deposit>` (BookingDetailPanel passes `platformDepAmt`), and CheckoutPanel `resolveDeskPrePaid` falls back to the booking price for a `prepaid` config when no stored amount exists. So a booking imported with no stored deposit (e.g. pay-at-venue era) would display/check out against the **new** setting. Bookings with a stored amount (all deposit imports) are unaffected. Recorded, not fixed — decide with the payment rule.
- Number vs string: whitecross's stored `depositAmount` is the string `'10'` (parser writes it verbatim into `paidAmount`); after a save from this screen it becomes the number `10`/`15`. All readers parse with `pp()/pence()`, so no behaviour change, but expect mixed types in `paidAmount` on new imports.

## 5. Next
1. Release decision for `f9286910` (Admin hosting only; no functions). It only changes behaviour for owners who press Save on Integrations; whitecross's current stored amount is not modified.
2. Then the £17 total/payment work resumes on the parser candidate (`36a03648`) with the checkout-guard scope decision (see HANDOFF_BOOKSY_MULTISERVICE_PART2).
