// THROWAWAY — callable-level (no browser) verification for STAFF-AVAIL-GAP-P2-VERIFY.
// Uses the REAL client Firebase Web SDK (not admin bypass) against a REAL Auth +
// Firestore + Functions emulator triple, calling the REAL deployed
// `salownCreateStaffWalkIn` callable. This proves server-side behavior only —
// it does NOT prove the React UI (WalkInFlow.tsx) computes/sends the same
// startTimeIso a real click would; that stays open pending an actual Chrome run.
// Never committed. Project demo-c1, isolated clone of aa2efd9.
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { writeFileSync } from 'fs'

const OUT_DIR = '/private/tmp/claude-501/-Users-alish/da044e32-667a-44c5-aaf1-636d18deb59a/scratchpad/staff-avail-gap-p2/evidence'
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

  // ── Test 1: instant preservation through conflict + owner override, barber `cara`
  //    (ACTIVE, seeded CONFIRMED booking 22:00-22:30Z / 23:00-23:30 BST 14 Sep).
  //    CONTROLLED clock, not real Date.now() — per owner direction: a repeatable method
  //    with a fixed instant, not dependent on catching real midnight. This instant
  //    (23:15 BST 14 Sep, local London date "yesterday" relative to real today 15 Sep)
  //    also exercises the historical/midnight-crossing classification, combined with a
  //    genuine D3 conflict (22:15-22:45 BST overlaps the seeded 23:00...wait 23:00-23:30
  //    booking — see the 15-min overlap 23:15-23:30). No production code changed; this
  //    is the harness's own literal, never real Date.now(). ──
  const startTimeIso = '2026-09-14T22:15:00.000Z' // 23:15 BST, 14 Sep
  record('test1-computed-instant', { startTimeIso, note: 'CONTROLLED fixed instant (not real Date.now()) — captured ONCE, reused verbatim below, mirrors WalkInFlow.tsx closing over `start`' })

  const key1 = `harness-${Date.now()}-1`
  const basePayload1 = {
    barberRef: 'cara', serviceId: 'svc1', startTime: startTimeIso, durationMins: 30,
    clientName: 'Callable Harness Client 1', idempotencyKey: key1,
  }

  // 1a. STAFF attempts the conflicting slot with NO override — expect a conflict refusal.
  const r1a = await callAs('mid-staff@p2.test', PW, 'salownCreateStaffWalkIn', basePayload1)
  record('test1a-staff-no-override', r1a)

  // 1b. STAFF attempts to smuggle an override object anyway (bypassing the client's own
  //     role gate) — server must refuse regardless, proving enforcement is server-side.
  const r1b = await callAs('mid-staff@p2.test', PW, 'salownCreateStaffWalkIn', {
    ...basePayload1, idempotencyKey: `${key1}-b`,
    overrideConflict: true, overrideReason: 'staff trying to self-override', acknowledgedConflictIds: ['midConflictSeed'],
  })
  record('test1b-staff-smuggled-override', r1b)

  // 1c. OWNER attempts the same slot, no override — expect the conflict refusal, carrying
  //     the conflicting booking id(s) to acknowledge.
  const r1c = await callAs('mid-owner@p2.test', PW, 'salownCreateStaffWalkIn', basePayload1)
  record('test1c-owner-no-override', r1c)

  // 1d. OWNER retries with the SAME startTimeIso + override — expect SUCCESS, and the
  //     created booking's startTime must equal startTimeIso EXACTLY (not re-derived).
  const conflictIds = (r1c.details && r1c.details.conflictingRecordIds) || (r1c.details && r1c.details.conflictIds) || ['midConflictSeed']
  const r1d = await callAs('mid-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    ...basePayload1, idempotencyKey: `${key1}-d`,
    overrideConflict: true, overrideReason: 'harness owner override, instant-preservation check', acknowledgedConflictIds: conflictIds,
  })
  record('test1d-owner-override-success', r1d)

  // ── Test 2: midnight-crossing / historical-day classification must NOT bypass
  //    STAFF_PASSIVE for the Staff App walk-in surface (historicalExemptionAllowed:false) ──
  const startTimeIso2 = '2026-09-14T19:00:00.000Z' // CONTROLLED fixed instant, 20:00 BST 14 Sep (historical relative to real today 15 Sep), barber `bea` (status: passive)
  const key2 = `harness-${Date.now()}-2`
  const r2 = await callAs('mid-owner@p2.test', PW, 'salownCreateStaffWalkIn', {
    barberRef: 'bea', serviceId: 'svc1', startTime: startTimeIso2, durationMins: 30,
    clientName: 'Callable Harness Client 2 (passive barber)', idempotencyKey: key2,
  })
  record('test2-passive-barber-historical-day', { startTimeIso: startTimeIso2, ...r2 })

  writeFileSync(`${OUT_DIR}/callable-check-results.json`, JSON.stringify(log, null, 2))
  console.log('\n=== DONE, full log written to evidence/callable-check-results.json ===')
}

main().then(() => process.exit(0)).catch((e) => { console.error('HARNESS ERROR', e); process.exit(1) })
