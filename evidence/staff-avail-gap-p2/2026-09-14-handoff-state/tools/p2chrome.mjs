// THROWAWAY (never committed) — evidence harness for the second Chrome round (New Booking regression +
// owner untouched-time Save & Checkout). Local emulators only (127.0.0.1, project demo-c1). Synthetic
// tenant `p2c`, presentation timezone America/Los_Angeles (daytime while the run happens in London night).
//   node p2chrome.mjs seed
//   node p2chrome.mjs seedBackdateConflict            → Alex booking covering [LA now-45min, LA now-15min]
//   node p2chrome.mjs snapshot <label>                → evidence-p2b/chrome/<label>.json (FULL documents)
//   node p2chrome.mjs diff <beforeLabel> <afterLabel> → content-level diff of every document in the tenant subtree
import { createRequire } from 'module';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const app = admin.initializeApp({ projectId: 'demo-c1' });
if (app.options.projectId !== 'demo-c1') { console.error('REFUSING: not demo-c1'); process.exit(3); }
const db = getFirestore(); const auth = getAuth();
const T = 'p2c', TZ = 'America/Los_Angeles', PW = process.env.P2_TEST_PASSWORD;
const DIR = '/private/tmp/claude-501/-Users-alish/1b4e7c9f-b90b-4cb4-9da8-c744b257a970/scratchpad/evidence-p2b/chrome';
mkdirSync(DIR, { recursive: true });

const parts = (ms) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)); const g = (t) => Number(p.find((x) => x.type === t).value); return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute') }; };
const offMin = (ms) => { const q = parts(ms); return (Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi) - Math.floor(ms / 60000) * 60000) / 60000; };
const zoned = (y, mo, d, h, mi) => { const n = Date.UTC(y, mo - 1, d, h, mi); return n - offMin(n - offMin(n) * 60000) * 60000; };
const iso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? { __ts: v.toDate().toISOString() } : v)));

async function user(email, claims) { let u; try { u = await auth.getUserByEmail(email); } catch { u = await auth.createUser({ email, password: PW }); } await auth.setCustomUserClaims(u.uid, claims); return u.uid; }

async function seed() {
  const now = parts(Date.now());
  const tomorrow = new Date(Date.UTC(now.y, now.mo - 1, now.d + 1, 12));
  const tk = { y: tomorrow.getUTCFullYear(), mo: tomorrow.getUTCMonth() + 1, d: tomorrow.getUTCDate() };
  const tomorrowKey = `${tk.y}-${String(tk.mo).padStart(2, '0')}-${String(tk.d).padStart(2, '0')}`;
  const uids = {};
  for (const r of ['owner', 'staff']) { uids[r] = await user(`c-${r}@p2.test`, { tenantId: T, tenantRole: r }); await db.doc(`tenants/${T}/staff/${uids[r]}`).set({ role: r, email: `c-${r}@p2.test`, name: `c ${r}` }); }
  const allDay = { open: '00:00', close: '23:59' };
  await Promise.all([
    db.doc(`tenants/${T}`).set({ name: 'P2 chrome round 2', features: {}, presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/settings`).set({ presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/hours`).set({}),
    db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true, category: 'Hair' }),
    db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay, order: 1 }),
    db.doc(`tenants/${T}/barbers/bea`).set({ name: 'Bea', status: 'active', hours: allDay, order: 2 }),
    db.doc(`tenants/${T}/barbers/lee`).set({ name: 'Lee', status: 'leave', hours: allDay, order: 3 }),
  ]);
  const a14 = zoned(tk.y, tk.mo, tk.d, 14, 0), b13 = zoned(tk.y, tk.mo, tk.d, 13, 0);
  await db.doc(`tenants/${T}/bookings/nbSeedAlex1400`).set({ bookingId: 'SEED-NB-ALEX', status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Existing Client', serviceId: 'svc1', serviceName: 'Haircut', duration: 30, price: 20, source: 'Staff App', bookingType: 'booking', date: tomorrowKey, time: '14:00', startTime: Timestamp.fromMillis(a14), endTime: Timestamp.fromMillis(a14 + 1800000), createdAt: Timestamp.now() });
  await db.doc(`tenants/${T}/bookings/nbSeedBeaBlock1300`).set({ bookingId: 'BLOCKED-NB-BEA', status: 'BLOCKED', barberId: 'bea', barberName: 'bea', source: 'block', blockKind: 'block', note: 'Lunch', startTime: Timestamp.fromMillis(b13), endTime: Timestamp.fromMillis(b13 + 1800000), createdAt: Timestamp.now() });
  console.log(JSON.stringify({ tenant: T, timezone: TZ, laNow: `${now.y}-${now.mo}-${now.d} ${now.h}:${String(now.mi).padStart(2, '0')}`, tomorrowKey, seeded: ['nbSeedAlex1400 (Alex 14:00-14:30)', 'nbSeedBeaBlock1300 (Bea BLOCKED 13:00-13:30)'], users: ['c-owner@p2.test', 'c-staff@p2.test'] }));
}

async function seedBackdateConflict() {
  const nowMs = Date.now();
  const ref = db.doc(`tenants/${T}/bookings/bdSeedAlexRecent`);
  await ref.set({ bookingId: 'SEED-BD-ALEX', status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Previous Client', serviceId: 'svc1', serviceName: 'Haircut', duration: 30, price: 20, source: 'Walk-in', bookingType: 'walkin', startTime: Timestamp.fromMillis(nowMs - 45 * 60000), endTime: Timestamp.fromMillis(nowMs - 15 * 60000), createdAt: Timestamp.now() });
  const s = parts(nowMs - 45 * 60000), e = parts(nowMs - 15 * 60000);
  console.log(JSON.stringify({ seeded: 'bdSeedAlexRecent', laStart: `${s.h}:${String(s.mi).padStart(2, '0')}`, laEnd: `${e.h}:${String(e.mi).padStart(2, '0')}` }));
}

// New Booking (createBookingCore) turns the form's date + time into an instant with Europe/London
// (wrapper timeZone 'Europe/London', londonMs), whatever the tenant timezone says. These seeds are
// placed on THAT interpretation so the regression exercises the real conflict/BLOCKED branches.
async function seedLondonNb() {
  const now = parts(Date.now());
  const t = new Date(Date.UTC(now.y, now.mo - 1, now.d + 1, 12));
  const y = t.getUTCFullYear(), mo = t.getUTCMonth() + 1, d = t.getUTCDate();
  const offL = (ms) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)); const g = (k) => Number(p.find((x) => x.type === k).value); return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000) / 60000; };
  const london = (h, mi) => { const n = Date.UTC(y, mo - 1, d, h, mi); return n - offL(n - offL(n) * 60000) * 60000; };
  const a11 = london(11, 0), b12 = london(12, 0);
  const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  await db.doc(`tenants/${T}/bookings/nbLonAlex1100`).set({ bookingId: 'SEED-NB-LON-ALEX', status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Existing Client (London instant)', serviceId: 'svc1', serviceName: 'Haircut', duration: 30, price: 20, source: 'Staff App', bookingType: 'booking', date: key, time: '11:00', startTime: Timestamp.fromMillis(a11), endTime: Timestamp.fromMillis(a11 + 1800000), createdAt: Timestamp.now() });
  await db.doc(`tenants/${T}/bookings/nbLonBeaBlock1200`).set({ bookingId: 'BLOCKED-NB-LON-BEA', status: 'BLOCKED', barberId: 'bea', barberName: 'bea', source: 'block', blockKind: 'block', note: 'Lunch', startTime: Timestamp.fromMillis(b12), endTime: Timestamp.fromMillis(b12 + 1800000), createdAt: Timestamp.now() });
  console.log(JSON.stringify({ dateKey: key, seeded: [`nbLonAlex1100 ${new Date(a11).toISOString()}`, `nbLonBeaBlock1200 ${new Date(b12).toISOString()}`] }));
}

async function walk(ref, out) {
  for (const col of await ref.listCollections()) for (const d of (await col.get()).docs) { out.push({ path: d.ref.path.replace(`tenants/${T}/`, ''), createTime: d.createTime.toDate().toISOString(), updateTime: d.updateTime.toDate().toISOString(), data: plain(d.data()) }); await walk(d.ref, out); }
}
async function snapshot(label) {
  const root = await db.doc(`tenants/${T}`).get();
  const docs = [{ path: '(tenant root)', createTime: root.createTime.toDate().toISOString(), updateTime: root.updateTime.toDate().toISOString(), data: plain(root.data()) }];
  await walk(db.doc(`tenants/${T}`), docs);
  docs.sort((a, b) => a.path.localeCompare(b.path));
  const byCol = {}; for (const d of docs) { const c = d.path.includes('/') ? d.path.split('/').slice(0, -1).join('/') : d.path; byCol[c] = (byCol[c] || 0) + 1; }
  const out = { label, capturedAt: new Date().toISOString(), environment: { projectId: app.options.projectId, firestoreHost: process.env.FIRESTORE_EMULATOR_HOST, tenant: T, timezone: TZ }, countsByCollection: byCol, documents: docs };
  writeFileSync(`${DIR}/${label}.json`, JSON.stringify(out, null, 2));
  console.log(`${label}: ${JSON.stringify(byCol)}`);
}
function diff(b, a) {
  const B = JSON.parse(readFileSync(`${DIR}/${b}.json`, 'utf8')), A = JSON.parse(readFileSync(`${DIR}/${a}.json`, 'utf8'));
  const mb = Object.fromEntries(B.documents.map((d) => [d.path, d])), ma = Object.fromEntries(A.documents.map((d) => [d.path, d]));
  const added = Object.keys(ma).filter((p) => !mb[p]), removed = Object.keys(mb).filter((p) => !ma[p]);
  const changed = Object.keys(ma).filter((p) => mb[p] && JSON.stringify(mb[p].data) !== JSON.stringify(ma[p].data));
  const out = { before: b, after: a, window: [B.capturedAt, A.capturedAt], scope: 'FULL document data of every document under tenants/p2c (recursive) + the tenant root; deletions detected as removed paths', added: added.map((p) => ({ path: p, data: ma[p].data })), removed, contentChanged: changed.map((p) => ({ path: p, before: mb[p].data, after: ma[p].data })) };
  writeFileSync(`${DIR}/diff__${b}__${a}.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ added: added, removed, contentChanged: changed }));
}

const [mode, x, y] = process.argv.slice(2);
if (mode === 'seed') await seed();
else if (mode === 'seedBackdateConflict') await seedBackdateConflict();
else if (mode === 'seedLondonNb') await seedLondonNb();
else if (mode === 'snapshot') await snapshot(x);
else if (mode === 'diff') diff(x, y);
else console.error('usage');
process.exit(0);
