// THROWAWAY (never committed) — salownCreateStaffBooking protocol matrix, run once against the NEW
// server (9ea0aca) and once against the OLD live Phase-1 server (797c9b3), both on local emulators
// (project demo-c1, synthetic tenant p2nb). The payloads are built exactly as the NEW Staff client's
// callSalownCreateStaffBooking builds them. Output is normalised (doc ids → case labels) so the two
// runs can be diffed. Never prints tokens or passwords.
//   node compat.mjs <label>   → evidence/compat-<label>.json
import { createRequire } from 'module';
import { writeFileSync } from 'fs';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const app = admin.initializeApp({ projectId: 'demo-c1' });
if (app.options.projectId !== 'demo-c1') process.exit(3);
const db = getFirestore(); const auth = getAuth();
const label = process.argv[2];
if (!label) { console.error('label required'); process.exit(2); }
const T = 'p2nb', PW = process.env.P2_TEST_PASSWORD, FN = 'http://127.0.0.1:5001/demo-c1/europe-west2';
const DATE = '2026-09-20'; // future Sunday; barbers carry explicit all-day or short shifts

async function user(email, claims) {
  let u; try { u = await auth.getUserByEmail(email); } catch { u = await auth.createUser({ email, password: PW }); }
  await auth.setCustomUserClaims(u.uid, claims); return u.uid;
}
async function token(email) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW, returnSecureToken: true }) });
  const j = await r.json(); if (!j.idToken) throw new Error('sign-in failed for ' + email); return j.idToken;
}
// wipe + seed a deterministic tenant
for (const col of ['bookings', 'bookingRequests', 'auditLogs', 'staff', 'barbers', 'services', 'settings']) {
  const s = await db.collection(`tenants/${T}/${col}`).get(); await Promise.all(s.docs.map((d) => d.ref.delete()));
}
const uids = {};
for (const r of ['owner', 'admin', 'staff']) { uids[r] = await user(`nb-${r}@p2.test`, { tenantId: T, tenantRole: r }); await db.doc(`tenants/${T}/staff/${uids[r]}`).set({ role: r }); }
uids.super = await user('nb-super@p2.test', { tenantId: T, superAdmin: true });
const allDay = { open: '00:00', close: '23:59' };
await Promise.all([
  db.doc(`tenants/${T}`).set({ name: 'P2 new-booking compat', features: {} }),
  db.doc(`tenants/${T}/settings/settings`).set({}),
  db.doc(`tenants/${T}/settings/hours`).set({}),
  db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true }),
  db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay }),
  db.doc(`tenants/${T}/barbers/bea`).set({ name: 'Bea', status: 'active', hours: allDay }),
  db.doc(`tenants/${T}/barbers/lee`).set({ name: 'Lee', status: 'leave', hours: allDay }),
  db.doc(`tenants/${T}/barbers/sam`).set({ name: 'Sam', status: 'active', hours: { open: '09:00', close: '10:00' } }),
]);
const blockStart = Date.UTC(2026, 8, 20, 12, 0); // 13:00 BST
await db.doc(`tenants/${T}/bookings/seedBlock`).set({ bookingId: 'BLOCKED-SEED', status: 'BLOCKED', barberId: 'bea', barberName: 'bea', source: 'block', blockKind: 'block', startTime: Timestamp.fromMillis(blockStart), endTime: Timestamp.fromMillis(blockStart + 30 * 60000) });

const tk = {}; for (const r of ['owner', 'admin', 'staff', 'super']) tk[r] = await token(`nb-${r}@p2.test`);
const labels = { seedBlock: 'seedBlock' };
const norm = (v) => (typeof v === 'string' && labels[v]) ? labels[v] : v;
// exactly the NEW client's callSalownCreateStaffBooking payload construction
function payload(i) {
  const p = { serviceId: 'svc1', barberId: i.barberId, date: DATE, time: i.time, clientName: 'Compat Client', idempotencyKey: i.key };
  p.durationMins = 30; p.serviceName = 'Haircut';
  if (i.override) Object.assign(p, i.override);
  return p;
}
async function call(name, who, data) {
  const r = await fetch(`${FN}/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(who ? { authorization: `Bearer ${tk[who]}` } : {}) }, body: JSON.stringify({ data }) });
  let body = null; try { body = await r.json(); } catch { body = { nonJson: true }; }
  return { http: r.status, body };
}
const rows = [];
async function kase(id, who, input, callable = 'salownCreateStaffBooking') {
  const res = await call(callable, who, callable === 'salownCreateStaffBooking' ? payload(input) : input);
  const out = { case: id, who, http: res.http };
  if (res.body && res.body.result) {
    out.result = { ok: res.body.result.ok, status: res.body.result.status, replayed: res.body.result.replayed, bookingIdShape: /^WCB-\d+-[0-9a-f]{4}$/.test(res.body.result.bookingId || '') };
    if (res.body.result.documentId && !labels[res.body.result.documentId]) labels[res.body.result.documentId] = id;
    out.result.documentId = norm(res.body.result.documentId);
  } else if (res.body && res.body.error) {
    const d = res.body.error.details || {};
    out.error = { status: res.body.error.status, message: res.body.error.message, detailKeys: Object.keys(d).filter((k) => d[k] !== undefined && d[k] !== null).sort(), reason: d.reason ?? null,
      conflictingRecordIds: Array.isArray(d.conflictingRecordIds) ? d.conflictingRecordIds.map(norm).sort() : undefined,
      shiftStartMins: d.shiftStartMins, shiftEndMins: d.shiftEndMins, requestedStartMins: d.requestedStartMins };
  } else out.raw = res.body;
  rows.push(out); return res;
}
await kase('c01_staff_plain_create', 'staff', { barberId: 'alex', time: '14:00', key: 'cmp-c01-key' });
const c02 = await kase('c02_staff_same_slot', 'staff', { barberId: 'alex', time: '14:00', key: 'cmp-c02-key' });
await kase('c03_staff_override', 'staff', { barberId: 'alex', time: '14:00', key: 'cmp-c03-key', override: { overrideConflict: true, overrideReason: 'compat', acknowledgedConflictIds: c02.body.error.details.conflictingRecordIds } });
await kase('c04_admin_override', 'admin', { barberId: 'alex', time: '14:00', key: 'cmp-c04-key', override: { overrideConflict: true, overrideReason: 'compat', acknowledgedConflictIds: c02.body.error.details.conflictingRecordIds } });
await kase('c05_superadmin_claim_only', 'super', { barberId: 'alex', time: '15:00', key: 'cmp-c05-key' });
await kase('c06_owner_override_no_ack', 'owner', { barberId: 'alex', time: '14:00', key: 'cmp-c06-key', override: { overrideConflict: true, overrideReason: 'compat' } });
await kase('c07_owner_override_ack', 'owner', { barberId: 'alex', time: '14:00', key: 'cmp-c07-key', override: { overrideConflict: true, overrideReason: 'compat agreed', acknowledgedConflictIds: c02.body.error.details.conflictingRecordIds } });
await kase('c08_owner_override_ack_replay', 'owner', { barberId: 'alex', time: '14:00', key: 'cmp-c07-key', override: { overrideConflict: true, overrideReason: 'compat agreed', acknowledgedConflictIds: c02.body.error.details.conflictingRecordIds } });
await kase('c09_owner_vs_blocked', 'owner', { barberId: 'bea', time: '13:00', key: 'cmp-c09-key', override: { overrideConflict: true, overrideReason: 'compat', acknowledgedConflictIds: ['seedBlock'] } });
await kase('c10_staff_outside_shift', 'staff', { barberId: 'sam', time: '11:00', key: 'cmp-c10-key' });
await kase('c11_owner_hours_override', 'owner', { barberId: 'sam', time: '11:00', key: 'cmp-c11-key', override: { overrideConflict: true, overrideReason: 'late client' } });
await kase('c12_owner_undated_leave', 'owner', { barberId: 'lee', time: '15:00', key: 'cmp-c12-key', override: { overrideConflict: true, overrideReason: 'compat' } });
await kase('c13_unauthenticated', null, { barberId: 'alex', time: '16:00', key: 'cmp-c13-key' });
// the Phase-2 walk-in callable: present on the new server, absent on the old one
await kase('c14_staff_walkin_callable_presence', 'staff', { barberRef: 'alex', serviceId: 'svc1', startTime: '2026-09-20T15:00:00.000Z', durationMins: 30, clientName: 'Compat', idempotencyKey: 'cmp-c14-key' }, 'salownCreateStaffWalkIn');

const audits = (await db.collection(`tenants/${T}/auditLogs`).get()).docs.map((d) => d.data()).filter((a) => a.action === 'STAFF_BOOKING_POLICY_OVERRIDE')
  .map((a) => ({ actorRole: a.actor?.role, targetCase: norm(a.target?.docId), topLevelKeys: Object.keys(a).sort(), metaKeys: Object.keys(a.meta || {}).sort(), dimensions: { ...a.meta?.dimensions, conflictingRecordIds: (a.meta?.dimensions?.conflictingRecordIds || []).map(norm) }, reason: a.meta?.reason }))
  .sort((x, y) => String(x.targetCase).localeCompare(String(y.targetCase)));
const bookings = (await db.collection(`tenants/${T}/bookings`).get()).size;
const out = { label, capturedAt: new Date().toISOString(), environment: { projectId: app.options.projectId, tenant: T, functionsHost: FN }, cases: rows, overrideAudits: audits, bookingDocsAfter: bookings };
writeFileSync(`./evidence/compat-${label}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(rows.map((r) => `${r.case}: http ${r.http} ${r.result ? 'ok replayed=' + r.result.replayed : (r.error ? r.error.status + ' ' + r.error.reason + (r.error.conflictingRecordIds ? ' ids=' + r.error.conflictingRecordIds.join('+') : '') : JSON.stringify(r.raw).slice(0, 60))}`), null, 1));
console.log(`override audits: ${audits.length}; booking docs: ${bookings}`);
process.exit(0);
