// THROWAWAY — callable-level (no browser) verification for STAFF-AVAIL-GAP-P2-VERIFY2,
// closing items 4/8/9 of the 9-scenario acceptance checklist. Uses the REAL client Firebase
// Web SDK against a REAL Auth + Firestore + Functions emulator triple, calling the REAL
// `salownCreateStaffWalkIn` callable — no admin-SDK bypass. Controlled fixed instants, not
// Date.now(). Never committed. Project demo-c1, isolated clone of aa2efd9.
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { writeFileSync } from 'fs'

const OUT_DIR = '/private/tmp/claude-501/-Users-alish/6bbe1b50-b9fc-40dd-965b-40fb4ca6bdfa/scratchpad/staff-avail-gap-p2/evidence'
const app = initializeApp({ apiKey: 'fake', authDomain: 'demo-c1.firebaseapp.com', projectId: 'demo-c1' })
const auth = getAuth(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
const fns = getFunctions(app, 'europe-west2')
connectFunctionsEmulator(fns, '127.0.0.1', 5001)

async function callAs(email, password, fnName, payload) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  const tokenResult = await cred.user.getIdTokenResult(true)
  const call = httpsCallable(fns, fnName)
  try {
    const res = await call(payload)
    return { ok: true, claims: tokenResult.claims, data: res.data }
  } catch (err) {
    return { ok: false, claims: tokenResult.claims, code: err.code, message: err.message, details: err.details }
  }
}

const log = []
const record = (label, obj) => { log.push({ label, at: new Date().toISOString(), ...obj }); console.log(JSON.stringify({ label, ...obj }, null, 2)) }

async function main() {
  const PW = 'TestPass123!'

  // ── Item 4: long service, MAX_DURATION_MINS (createWalkIn.ts:74, =1440) must still refuse,
  //    proving the instant-based backdate computation did not accidentally widen or bypass
  //    this upstream validation. durationMins=1441 (24h + 1min). ──
  const r4 = await callAs('v2-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    barberRef: 'alex', serviceId: 'svc1', startTime: '2026-09-14T22:00:00.000Z', durationMins: 1441,
    clientName: 'Item4 long-duration client', idempotencyKey: `item4-${Date.now()}`,
  })
  record('item4-long-duration-refused', r4)

  // Negative control: durationMins=1440 (exactly MAX_DURATION_MINS, the boundary — not over
  // it) must NOT be rejected by the same INVALID_INPUT/durationMins guard r4 hit — proving r4's
  // refusal is specifically the >1440 boundary, not a blanket rejection of any long duration.
  // A 1440-min (full calendar day) request necessarily exceeds any single day's minutes-of-day
  // shift window (max 1439), so it is expected to reach the HOURS policy instead and be
  // resolved there (owner override) rather than fail validation before the transaction even
  // starts. startTime = exact local midnight (2026-09-13T00:00 BST = 2026-09-12T23:00:00Z) so
  // the shift-overrun is exactly 1 minute, isolating the boundary cleanly.
  const r4b = await callAs('v2-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    barberRef: 'alex', serviceId: 'svc1', startTime: '2026-09-12T23:00:00.000Z', durationMins: 1440,
    clientName: 'Item4 negative-control at-boundary client', idempotencyKey: `item4b-${Date.now()}`,
    overrideConflict: true, overrideReason: 'item4 harness boundary probe, 1440 vs 1441',
  })
  record('item4b-at-boundary-not-input-rejected', r4b)

  // ── Item 8: conflict correctness across midnight. Existing booking `midStraddleSeed`
  //    (barber alex) occupies 22:50Z-23:30Z 14 Sep — LOCAL 23:50 BST 14 Sep -> 00:30 BST 15
  //    Sep, i.e. its OWN interval straddles local midnight. Walk-in requests a backdated
  //    start of 22:40Z 14 Sep (23:40 BST 14 Sep), 30 min -> ends 23:10Z 14 Sep (00:10 BST 15
  //    Sep). Overlap: 22:50Z-23:10Z (20 min). Expect SLOT_CONFLICT naming midStraddleSeed. ──
  const item8Start = '2026-09-14T22:40:00.000Z'
  const r8 = await callAs('v2-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    barberRef: 'alex', serviceId: 'svc1', startTime: item8Start, durationMins: 30,
    clientName: 'Item8 midnight-straddle conflict client', idempotencyKey: `item8-${Date.now()}`,
  })
  record('item8-conflict-across-midnight', { startTimeIso: item8Start, ...r8 })

  // Follow-up: owner override with the SAME instant, acknowledging the straddling record —
  // proves the conflict record was genuinely matched (not a false positive against something
  // else), and instant preservation holds for this seed shape too.
  const conflictIds8 = (r8.details && r8.details.conflictingRecordIds) || ['midStraddleSeed']
  const r8b = await callAs('v2-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    barberRef: 'alex', serviceId: 'svc1', startTime: item8Start, durationMins: 30,
    clientName: 'Item8 midnight-straddle conflict client', idempotencyKey: `item8-${Date.now()}-override`,
    overrideConflict: true, overrideReason: 'item8 harness override across a midnight-straddling seed', acknowledgedConflictIds: conflictIds8,
  })
  record('item8b-owner-override-success', { startTimeIso: item8Start, ...r8b })

  // ── Item 9: shift-fit correctness across midnight. Barber `cara` has shiftChanges:
  //    2026-09-14 open 22:00-23:59; 2026-09-15 closed. Walk-in requests a backdated start
  //    of 22:00Z 14 Sep (23:00 BST 14 Sep), 30 min. If tenantDateKey(startMs, tz) correctly
  //    resolves to "2026-09-14" (yesterday, relative to a real "today" of 15 Sep), this fits
  //    cara's 22:00-23:59 shift and SUCCEEDS. If the resolver instead picked "today"
  //    (2026-09-15, closed), this would be refused STAFF_UNAVAILABLE. ──
  const item9Start = '2026-09-14T22:00:00.000Z'
  const r9 = await callAs('v2-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    barberRef: 'cara', serviceId: 'svc1', startTime: item9Start, durationMins: 30,
    clientName: 'Item9 shift-fit-across-midnight client', idempotencyKey: `item9-${Date.now()}`,
  })
  record('item9-shift-fit-across-midnight', { startTimeIso: item9Start, expectedIfBuggy: 'STAFF_UNAVAILABLE (would mean "today"\'s closed shift was used)', ...r9 })

  writeFileSync(`${OUT_DIR}/callable-check2-results.json`, JSON.stringify(log, null, 2))
  console.log('\n=== DONE, full log written to evidence/callable-check2-results.json ===')
}

main().then(() => process.exit(0)).catch((e) => { console.error('HARNESS ERROR', e); process.exit(1) })
