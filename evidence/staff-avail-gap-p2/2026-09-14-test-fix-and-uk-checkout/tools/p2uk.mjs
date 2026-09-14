// THROWAWAY (never committed) — Europe/London counterpart to p2chrome.mjs's p2c (America/Los_Angeles)
// tenant, used ONLY to fill the one gap the round-2 evidence named: the owner untouched-time
// Save & Checkout backdate check had only been run on a non-UK tenant. Local emulators only
// (127.0.0.1, project demo-c1). Synthetic tenant `p2uk`, presentation.timezone Europe/London.
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const app = admin.initializeApp({ projectId: 'demo-c1' });
if (app.options.projectId !== 'demo-c1') { console.error('REFUSING: not demo-c1'); process.exit(3); }
const db = getFirestore(); const auth = getAuth();
const T = 'p2uk', TZ = 'Europe/London', PW = process.env.P2_TEST_PASSWORD;
const DIR = '/private/tmp/claude-501/-Users-alish/13dc2679-2b57-4268-8fb7-68eb20581502/scratchpad/evidence-runs/2026-09-14-uk-backdated-checkout';
mkdirSync(DIR, { recursive: true });

const parts = (ms) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)); const g = (t) => Number(p.find((x) => x.type === t).value); return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute') }; };
const offMin = (ms) => { const q = parts(ms); return (Date.UTC(q.y, q.mo - 1, q.d, q.h, q.mi) - Math.floor(ms / 60000) * 60000) / 60000; };
const zoned = (y, mo, d, h, mi) => { const n = Date.UTC(y, mo - 1, d, h, mi); return n - offMin(n - offMin(n) * 60000) * 60000; };
const plain = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? { __ts: v.toDate().toISOString() } : v)));

async function user(email, claims) { let u; try { u = await auth.getUserByEmail(email); } catch { u = await auth.createUser({ email, password: PW }); } await auth.setCustomUserClaims(u.uid, claims); return u.uid; }

async function seed() {
  const uids = {};
  for (const r of ['owner', 'staff']) { uids[r] = await user(`uk-${r}@p2.test`, { tenantId: T, tenantRole: r }); await db.doc(`tenants/${T}/staff/${uids[r]}`).set({ role: r, email: `uk-${r}@p2.test`, name: `uk ${r}` }); }
  const allDay = { open: '00:00', close: '23:59' };
  await Promise.all([
    db.doc(`tenants/${T}`).set({ name: 'P2 UK backdated checkout', features: {}, presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/settings`).set({ presentation: { timezone: TZ, language: 'en', locale: 'en-GB', currency: 'GBP', timeFormat: '24h', countryCode: 'GB' } }),
    db.doc(`tenants/${T}/settings/hours`).set({}),
    db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true, category: 'Hair' }),
    db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay, order: 1 }),
  ]);
  const now = parts(Date.now());
  writeFileSync(`${DIR}/seed-users.json`, JSON.stringify({ tenant: T, timezone: TZ, londonNow: `${now.y}-${String(now.mo).padStart(2,'0')}-${String(now.d).padStart(2,'0')} ${now.h}:${String(now.mi).padStart(2, '0')}`, users: ['uk-owner@p2.test', 'uk-staff@p2.test'] }, null, 1));
  console.log(JSON.stringify({ tenant: T, timezone: TZ, londonNow: `${now.h}:${String(now.mi).padStart(2, '0')}`, users: ['uk-owner@p2.test', 'uk-staff@p2.test'] }));
}

async function snapshot(label) {
  const cols = ['bookings', 'auditLogs'];
  const out = {};
  for (const c of cols) out[c] = Object.fromEntries((await db.collection(`tenants/${T}/${c}`).get()).docs.map((d) => [d.id, plain(d.data())]));
  writeFileSync(`${DIR}/${label}.json`, JSON.stringify(out, null, 1));
  console.log(`wrote ${DIR}/${label}.json`);
}

const mode = process.argv[2];
if (mode === 'seed') await seed();
else if (mode === 'snapshot') await snapshot(process.argv[3] || 'snap');
else { console.error('usage: node p2uk.mjs seed|snapshot <label>'); process.exit(2); }
process.exit(0);
