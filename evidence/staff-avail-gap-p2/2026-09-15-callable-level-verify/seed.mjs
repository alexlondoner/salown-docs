// THROWAWAY — evidence harness for STAFF-AVAIL-GAP-P2-VERIFY UK Save & Checkout Chrome
// rehearsal. Local emulators only (127.0.0.1, project demo-c1). Synthetic tenant `p2mid`,
// presentation timezone Europe/London. Never committed.
//   node seed.mjs seed
//   node seed.mjs seedConflict <startMs> <endMs>   → seed a CONFIRMED booking on the barber
//   node seed.mjs snapshot <label>
//   node seed.mjs diff <beforeLabel> <afterLabel>
import { createRequire } from 'module'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
const require = createRequire('/private/tmp/claude-501/-Users-alish/da044e32-667a-44c5-aaf1-636d18deb59a/scratchpad/staff-avail-gap-p2/clone-aa2efd9/functions/package.json')
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
const admin = require('firebase-admin')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const { getAuth } = require('firebase-admin/auth')
const app = admin.initializeApp({ projectId: 'demo-c1' })
if (app.options.projectId !== 'demo-c1') { console.error('REFUSING: not demo-c1'); process.exit(3) }
const db = getFirestore(); const auth = getAuth()
const T = 'p2mid', TZ = 'Europe/London', PW = 'TestPass123!'
const DIR = '/private/tmp/claude-501/-Users-alish/da044e32-667a-44c5-aaf1-636d18deb59a/scratchpad/staff-avail-gap-p2/evidence'
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
    uids[r] = await user(`mid-${r}@p2.test`, { tenantId: T, tenantRole: r })
    await db.doc(`tenants/${T}/staff/${uids[r]}`).set({ role: r, email: `mid-${r}@p2.test`, name: `Mid ${r}` })
  }
  const allDay = { open: '00:00', close: '23:59' }
  await Promise.all([
    db.doc(`tenants/${T}`).set({ name: 'P2 UK midnight rehearsal', features: {}, presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/settings`).set({ presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/hours`).set({}),
    db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true, category: 'Hair' }),
    db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay, order: 1 }),
  ])
  console.log(JSON.stringify({ tenant: T, timezone: TZ, nowUtc: new Date().toISOString(), users: [`mid-owner@p2.test`, `mid-staff@p2.test`], password: PW }))
}

async function seedConflict(startMs, endMs) {
  const ref = db.doc(`tenants/${T}/bookings/midConflictSeed`)
  await ref.set({ bookingId: 'SEED-MID-CONFLICT', status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Previous Client', serviceId: 'svc1', serviceName: 'Haircut', duration: 30, price: 20, source: 'Walk-in', bookingType: 'walkin', startTime: Timestamp.fromMillis(Number(startMs)), endTime: Timestamp.fromMillis(Number(endMs)), createdAt: Timestamp.now() })
  console.log(JSON.stringify({ seeded: 'midConflictSeed', start: new Date(Number(startMs)).toISOString(), end: new Date(Number(endMs)).toISOString() }))
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
function diff(b, a) {
  const B = JSON.parse(readFileSync(`${DIR}/${b}.json`, 'utf8')), A = JSON.parse(readFileSync(`${DIR}/${a}.json`, 'utf8'))
  const mb = Object.fromEntries(B.documents.map((d) => [d.path, d])), ma = Object.fromEntries(A.documents.map((d) => [d.path, d]))
  const added = Object.keys(ma).filter((p) => !mb[p])
  const changed = Object.keys(ma).filter((p) => mb[p] && JSON.stringify(mb[p].data) !== JSON.stringify(ma[p].data))
  const out = { before: b, after: a, added: added.map((p) => ({ path: p, data: ma[p].data })), contentChanged: changed.map((p) => ({ path: p, before: mb[p].data, after: ma[p].data })) }
  writeFileSync(`${DIR}/diff__${b}__${a}.json`, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

const [mode, x, y] = process.argv.slice(2)
if (mode === 'seed') await seed()
else if (mode === 'seedConflict') await seedConflict(x, y)
else if (mode === 'snapshot') await snapshot(x)
else if (mode === 'diff') diff(x, y)
else console.error('usage: seed|seedConflict <startMs> <endMs>|snapshot <label>|diff <b> <a>')
process.exit(0)
