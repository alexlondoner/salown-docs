// THROWAWAY — seed for the STAFF-AVAIL-GAP-P2-VERIFY3 Chrome rehearsal (isolated clone of
// aa2efd9, local emulators only, project demo-c1). Tenant `p2chrome`, Europe/London.
import { createRequire } from 'module'
import { mkdirSync, writeFileSync } from 'fs'
const require = createRequire('/private/tmp/claude-501/-Users-alish/6bbe1b50-b9fc-40dd-965b-40fb4ca6bdfa/scratchpad/staff-avail-gap-p2/rehearsal-aa2efd9/functions/package.json')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const admin = require('firebase-admin')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const app = admin.initializeApp({ projectId: 'demo-c1' })
if (app.options.projectId !== 'demo-c1') { console.error('REFUSING: not demo-c1'); process.exit(3) }
const db = getFirestore(); const auth = getAuth()
const T = 'p2chrome', TZ = 'Europe/London', PW = 'TestPass123!'
const DIR = '/private/tmp/claude-501/-Users-alish/6bbe1b50-b9fc-40dd-965b-40fb4ca6bdfa/scratchpad/staff-avail-gap-p2/evidence3'
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
    uids[r] = await user(`chrome-${r}@p2.test`, { tenantId: T, tenantRole: r })
    await db.doc(`tenants/${T}/staff/${uids[r]}`).set({ role: r, email: `chrome-${r}@p2.test`, name: `Chrome ${r}` })
  }
  const allDay = { open: '00:00', close: '23:59' }
  await Promise.all([
    db.doc(`tenants/${T}`).set({ name: 'P2 Chrome UK rehearsal', features: {}, presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/settings`).set({ presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/hours`).set({}),
    db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true, category: 'Hair' }),
    // `alex` — active, all-day hours, used for checks A/B and items 1/3/6.
    db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay, order: 1 }),
    // `bea` — PASSIVE, used for item 7 (historical-day exemption must NOT apply on staffApp).
    db.doc(`tenants/${T}/barbers/bea`).set({ name: 'Bea', status: 'passive', hours: allDay, order: 2 }),
  ])
  console.log(JSON.stringify({ tenant: T, timezone: TZ, nowUtc: new Date().toISOString(), users: [`chrome-owner@p2.test`, `chrome-staff@p2.test`], password: PW }))
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
async function seedConflict(startIso, endIso, label) {
  const ref = db.doc(`tenants/${T}/bookings/${label}`)
  await ref.set({ bookingId: `SEED-${label}`, status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Previous Client', serviceId: 'svc1', serviceName: 'Haircut', duration: (Date.parse(endIso) - Date.parse(startIso)) / 60000, price: 20, source: 'Walk-in', bookingType: 'walkin', startTime: Timestamp.fromMillis(Date.parse(startIso)), endTime: Timestamp.fromMillis(Date.parse(endIso)), createdAt: Timestamp.now() })
  console.log(JSON.stringify({ seeded: label, start: startIso, end: endIso }))
}

const [mode, a, b, c] = process.argv.slice(2)
if (mode === 'seed') await seed()
else if (mode === 'snapshot') await snapshot(a)
else if (mode === 'seedConflict') await seedConflict(a, b, c)
else console.error('usage: seed|snapshot <label>|seedConflict <startIso> <endIso> <label>')
process.exit(0)
