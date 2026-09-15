// THROWAWAY — evidence harness for STAFF-AVAIL-GAP-P2-VERIFY2, closing items 4/8/9 of the
// 9-scenario acceptance checklist (docs/evidence/staff-avail-gap-p2/2026-09-14-test-fix-and-uk-checkout/31-future-checkout-scope-options.md §7).
// Local emulators only (127.0.0.1, project demo-c1). Synthetic tenant `p2v2`,
// presentation timezone Europe/London. Never committed.
import { createRequire } from 'module'
import { mkdirSync, writeFileSync } from 'fs'
const require = createRequire('/private/tmp/claude-501/-Users-alish/6bbe1b50-b9fc-40dd-965b-40fb4ca6bdfa/scratchpad/staff-avail-gap-p2/clone-aa2efd9/functions/package.json')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const admin = require('firebase-admin')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const app = admin.initializeApp({ projectId: 'demo-c1' })
if (app.options.projectId !== 'demo-c1') { console.error('REFUSING: not demo-c1'); process.exit(3) }
const db = getFirestore(); const auth = getAuth()
const T = 'p2v2', TZ = 'Europe/London', PW = 'TestPass123!'
const DIR = '/private/tmp/claude-501/-Users-alish/6bbe1b50-b9fc-40dd-965b-40fb4ca6bdfa/scratchpad/staff-avail-gap-p2/evidence'
mkdirSync(DIR, { recursive: true })

const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? { __ts: v.toDate().toISOString() } : v)))

async function user(email, claims) {
  let u
  try { u = await auth.getUserByEmail(email) } catch { u = await auth.createUser({ email, password: PW }) }
  await auth.setCustomUserClaims(u.uid, claims)
  return u.uid
}

async function seed() {
  const uids = {}
  for (const r of ['owner', 'staff']) {
    uids[r] = await user(`v2-${r}@p2.test`, { tenantId: T, tenantRole: r })
    await db.doc(`tenants/${T}/staff/${uids[r]}`).set({ role: r, email: `v2-${r}@p2.test`, name: `V2 ${r}` })
  }
  const allDay = { open: '00:00', close: '23:59' }
  await Promise.all([
    db.doc(`tenants/${T}`).set({ name: 'P2 verify2 — items 4/8/9', features: {}, presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/settings`).set({ presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/hours`).set({}),
    db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true, category: 'Hair' }),
    // item 4/8: barber `alex` — all-day shift, no shiftChanges, used for the
    // MAX_DURATION_MINS refusal and the midnight-straddling-conflict check.
    db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay, order: 1 }),
    // item 9: barber `cara` — dated shiftChanges so "yesterday" and "today" differ.
    // 2026-09-14: open 22:00-23:59 (permits the backdated 23:00 request).
    // 2026-09-15: closed (would refuse STAFF_UNAVAILABLE if the resolver used "today").
    db.doc(`tenants/${T}/barbers/cara`).set({
      name: 'Cara', status: 'active', order: 2,
      shiftChanges: { '2026-09-14': { open: '22:00', close: '23:59' }, '2026-09-15': { closed: true } },
    }),
  ])
  console.log(JSON.stringify({ tenant: T, timezone: TZ, nowUtc: new Date().toISOString(), users: [`v2-owner@p2.test`, `v2-staff@p2.test`], password: PW }))
}

// item 8 — existing CONFIRMED booking whose OWN interval straddles local midnight:
// 22:50Z 14 Sep (23:50 BST 14 Sep) -> 23:30Z 14 Sep (00:30 BST 15 Sep), barber alex.
async function seedMidnightStraddleConflict() {
  const startMs = Date.parse('2026-09-14T22:50:00.000Z')
  const endMs = Date.parse('2026-09-14T23:30:00.000Z')
  const ref = db.doc(`tenants/${T}/bookings/midStraddleSeed`)
  await ref.set({ bookingId: 'SEED-MID-STRADDLE', status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Previous Client (straddles midnight)', serviceId: 'svc1', serviceName: 'Haircut', duration: 40, price: 20, source: 'Walk-in', bookingType: 'walkin', startTime: Timestamp.fromMillis(startMs), endTime: Timestamp.fromMillis(endMs), createdAt: Timestamp.now() })
  console.log(JSON.stringify({ seeded: 'midStraddleSeed', start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), note: 'local BST 23:50 14 Sep -> 00:30 15 Sep, crosses midnight itself' }))
}

async function walk(ref, out) {
  for (const col of await ref.listCollections()) for (const d of (await col.get()).docs) { out.push({ path: d.ref.path.replace(`tenants/${T}/`, ''), createTime: d.createTime.toDate().toISOString(), updateTime: d.updateTime.toDate().toISOString(), data: plain(d.data()) }); await walk(d.ref, out) }
}
async function snapshot(label) {
  const root = await db.doc(`tenants/${T}`).get()
  const docs = [{ path: '(tenant root)', createTime: root.createTime.toDate().toISOString(), updateTime: root.updateTime.toDate().toISOString(), data: plain(root.data()) }]
  await walk(db.doc(`tenants/${T}`), docs)
  docs.sort((a, b) => a.path.localeCompare(b.path))
  const out = { label, capturedAt: new Date().toISOString(), tenant: T, timezone: TZ, documents: docs }
  writeFileSync(`${DIR}/${label}.json`, JSON.stringify(out, null, 2))
  console.log(`${label}: ${docs.length} docs`)
}

const [mode] = process.argv.slice(2)
if (mode === 'seed') await seed()
else if (mode === 'seedMidnightStraddleConflict') await seedMidnightStraddleConflict()
else if (mode === 'snapshot') await snapshot(process.argv[3])
else console.error('usage: seed|seedMidnightStraddleConflict|snapshot <label>')
process.exit(0)
