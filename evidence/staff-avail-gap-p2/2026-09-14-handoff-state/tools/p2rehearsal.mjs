// THROWAWAY (never committed) — STAFF-AVAIL-GAP Phase 2 local rehearsal against the Auth +
// Firestore + Functions emulators (project demo-c1). Synthetic tenants only.
//   node p2rehearsal.mjs seed    → seeds p2api (token checks) + p2ui (Chrome)
//   node p2rehearsal.mjs tokens  → REAL Auth-emulator ID tokens → REAL HTTP → the callables
import { createRequire } from 'module';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
admin.initializeApp({ projectId: 'demo-c1' });
const db = getFirestore();
const auth = getAuth();
const PASSWORD = process.env.P2_TEST_PASSWORD;
const FN = 'http://127.0.0.1:5001/demo-c1/europe-west2';

const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const [Y, M, D] = todayKey.split('-').map(Number);
function londonMs(h, m) {
  // two-pass offset from ICU — same idea as instantFromZonedWallClock
  const naive = Date.UTC(Y, M - 1, D, h, m);
  const off = (ms) => {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms));
    const g = (t) => Number(p.find((x) => x.type === t).value);
    return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000) / 60000;
  };
  return naive - off(naive - off(naive) * 60000) * 60000;
}
const iso = (h, m) => new Date(londonMs(h, m)).toISOString();

async function ensureUser(email, claims) {
  let u;
  try { u = await auth.getUserByEmail(email); } catch { u = await auth.createUser({ email, password: PASSWORD, emailVerified: true }); }
  await auth.setCustomUserClaims(u.uid, claims);
  return u.uid;
}

async function seedTenant(T, prefix) {
  const uids = {};
  for (const role of ['owner', 'admin', 'staff']) {
    uids[role] = await ensureUser(`${prefix}-${role}@p2.test`, { tenantId: T, tenantRole: role });
    await db.doc(`tenants/${T}/staff/${uids[role]}`).set({ role, email: `${prefix}-${role}@p2.test`, name: `${prefix} ${role}` });
  }
  uids.super = await ensureUser(`${prefix}-super@p2.test`, { tenantId: T, superAdmin: true }); // NO staff doc
  const allDay = { open: '00:00', close: '23:59' };
  await Promise.all([
    db.doc(`tenants/${T}`).set({ name: `P2 ${prefix}`, features: {} }),
    db.doc(`tenants/${T}/settings/settings`).set({}),
    db.doc(`tenants/${T}/services/svc1`).set({ name: 'Haircut', duration: 30, price: 20, active: true, category: 'Hair' }),
    db.doc(`tenants/${T}/barbers/alex`).set({ name: 'Alex', status: 'active', hours: allDay, order: 1 }),
    db.doc(`tenants/${T}/barbers/bea`).set({ name: 'Bea', status: 'active', hours: allDay, order: 2 }),
    db.doc(`tenants/${T}/barbers/lee`).set({ name: 'Lee', status: 'leave', hours: allDay, order: 3 }),
    db.doc(`tenants/${T}/barbers/sam`).set({ name: 'Sam', status: 'active', hours: { open: '09:00', close: '10:00' }, order: 4 }),
  ]);
  const seeded = {};
  seeded.alexNoon = (await db.collection(`tenants/${T}/bookings`).add({
    bookingId: 'SEED-ALEX', status: 'CONFIRMED', barberId: 'alex', barberName: 'Alex', barber: 'alex', clientName: 'Existing Client',
    serviceId: 'svc1', serviceName: 'Haircut', duration: 30, price: 20, source: 'Walk-in', bookingType: 'walkin',
    startTime: Timestamp.fromMillis(londonMs(12, 0)), endTime: Timestamp.fromMillis(londonMs(12, 30)), createdAt: Timestamp.now(),
  })).id;
  seeded.beaBlock = (await db.collection(`tenants/${T}/bookings`).add({
    bookingId: 'BLOCKED-SEED', status: 'BLOCKED', barberId: 'bea', barberName: 'bea', source: 'block', blockKind: 'block', note: 'Lunch',
    startTime: Timestamp.fromMillis(londonMs(13, 0)), endTime: Timestamp.fromMillis(londonMs(13, 30)), createdAt: Timestamp.now(),
  })).id;
  return { uids, seeded };
}

async function token(email) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.idToken) throw new Error('sign-in failed ' + email + ' ' + JSON.stringify(j));
  return j.idToken;
}
async function call(name, idToken, data) {
  const r = await fetch(`${FN}/${name}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(idToken ? { authorization: `Bearer ${idToken}` } : {}) },
    body: JSON.stringify({ data }),
  });
  return r.json();
}
const walk = (over) => ({ barberRef: 'alex', serviceId: 'svc1', serviceName: 'Haircut', startTime: iso(12, 0), durationMins: 30, clientName: 'Token Check', price: 20, paymentType: 'CASH', source: 'Walk-in', bookingType: 'walkin', idempotencyKey: 'tok-' + Math.random().toString(36).slice(2, 12), ...over });

const results = [];
function check(name, cond, detail) { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  → ' + JSON.stringify(detail)}`); }
const reason = (res) => res && res.error && res.error.details && res.error.details.reason;

const mode = process.argv[2];
if (mode === 'seed') {
  const api = await seedTenant('p2api', 'api');
  const ui = await seedTenant('p2ui', 'ui');
  console.log(JSON.stringify({ todayKey, api, ui }, null, 1));
} else if (mode === 'tokens') {
  const T = 'p2api';
  const A = (await db.collection(`tenants/${T}/bookings`).where('bookingId', '==', 'SEED-ALEX').get()).docs[0].id;
  const tk = {};
  for (const r of ['owner', 'admin', 'staff', 'super']) tk[r] = await token(`api-${r}@p2.test`);
  const ownerUid = (await auth.getUserByEmail('api-owner@p2.test')).uid;
  const audits = async () => (await db.collection(`tenants/${T}/auditLogs`).where('action', '==', 'STAFF_BOOKING_POLICY_OVERRIDE').get()).docs.map((d) => d.data());
  const count = async () => (await db.collection(`tenants/${T}/bookings`).get()).size;

  let res = await call('salownCreateStaffWalkIn', null, walk());
  check('unauthenticated → UNAUTHENTICATED', reason(res) === 'UNAUTHENTICATED' || (res.error && res.error.status === 'UNAUTHENTICATED'), res);

  res = await call('salownCreateStaffWalkIn', tk.staff, walk());
  check('staff token, real conflict → SLOT_CONFLICT with the seeded id in details', reason(res) === 'SLOT_CONFLICT' && JSON.stringify(res.error.details.conflictingRecordIds) === JSON.stringify([A]), res);
  for (const r of ['staff', 'admin', 'super']) {
    res = await call('salownCreateStaffWalkIn', tk[r], walk({ overrideConflict: true, overrideReason: 'token check', acknowledgedConflictIds: [A] }));
    check(`${r} token override → OVERRIDE_REQUIRES_OWNER`, reason(res) === 'OVERRIDE_REQUIRES_OWNER', res);
  }
  res = await call('salownCreateStaffWalkIn', tk.owner, walk({ overrideConflict: true, overrideReason: 'token check' }));
  check('owner token override without ack → CONFLICT_ACK_REQUIRED', reason(res) === 'CONFLICT_ACK_REQUIRED', res);
  res = await call('salownCreateStaffWalkIn', tk.owner, walk({ barberRef: 'bea', startTime: iso(13, 0), overrideConflict: true, overrideReason: 'x', acknowledgedConflictIds: ['anything'] }));
  check('owner token vs BLOCKED → BLOCKED_TIME_CONFLICT', reason(res) === 'BLOCKED_TIME_CONFLICT', res);
  res = await call('salownCreateStaffWalkIn', tk.owner, walk({ barberRef: 'lee', startTime: iso(15, 0), overrideConflict: true, overrideReason: 'x' }));
  check('owner token vs undated leave → STAFF_UNAVAILABLE', reason(res) === 'STAFF_UNAVAILABLE', res);
  res = await call('salownCreateStaffWalkIn', tk.staff, walk({ barberRef: 'sam', startTime: iso(11, 0) }));
  check('staff token outside shift → OUTSIDE_EFFECTIVE_SHIFT with shift bounds in details', reason(res) === 'OUTSIDE_EFFECTIVE_SHIFT' && res.error.details.shiftEndMins === 600 && res.error.details.requestedStartMins === 660, res);
  check('no booking and no override audit written by any refusal so far', (await count()) === 2 && (await audits()).length === 0, { count: await count() });

  const before = await count();
  res = await call('salownCreateStaffWalkIn', tk.owner, walk({ overrideConflict: true, overrideReason: 'squeeze-in agreed with both', acknowledgedConflictIds: [A], idempotencyKey: 'tok-owner-final-1' }));
  check('owner token override with ack → created', res.result && res.result.ok === true, res);
  const logs = await audits();
  const log = logs[0] || {};
  const bk = res.result ? (await db.doc(`tenants/${T}/bookings/${res.result.documentId}`).get()).data() : {};
  check('audit row from the REAL token: actor uid/role/email, tenant, flow, reason, acknowledged ids, target', logs.length === 1
    && log.actor.uid === ownerUid && log.actor.role === 'owner' && log.actor.email === 'api-owner@p2.test'
    && log.tenantId === T && log.meta.flow === 'walkin' && log.meta.reason === 'squeeze-in agreed with both'
    && JSON.stringify(log.meta.dimensions.conflictingRecordIds) === JSON.stringify([A])
    && log.target.docId === res.result.documentId && log.meta.barberId === 'alex', log);
  check('booking content: canonical barber, exact start, walk-in shape', bk.barberId === 'alex' && bk.startTime.toMillis() === londonMs(12, 0) && bk.bookingType === 'walkin' && bk.source === 'Walk-in' && bk.status === 'CONFIRMED', bk);
  res = await call('salownCreateStaffWalkIn', tk.owner, walk({ overrideConflict: true, overrideReason: 'squeeze-in agreed with both', acknowledgedConflictIds: [A], idempotencyKey: 'tok-owner-final-1' }));
  check('owner retry with the same key → replayed, still one new booking + one audit', res.result && res.result.replayed === true && (await count()) === before + 1 && (await audits()).length === 1, res);

  res = await call('salownCreateStaffWalkIn', tk.super, walk({ startTime: iso(21, 0), idempotencyKey: 'tok-super-clean-1' }));
  check('bare superAdmin token: a policy-clean Staff walk-in is still accepted (legacy creation authority kept)', res.result && res.result.ok === true, res);

  res = await call('salownCreateWalkIn', tk.owner, walk({ overrideConflict: true, overrideReason: 'x' }));
  check('ADMIN callable salownCreateWalkIn rejects override fields as forbidden input', res.error && res.error.status === 'INVALID_ARGUMENT' && reason(res) === 'INVALID_INPUT', res);
  res = await call('salownCreateWalkIn', tk.admin, walk({ barberRef: 'lee', startTime: iso(16, 0), idempotencyKey: 'tok-admin-legacy-1' }));
  check('ADMIN callable salownCreateWalkIn keeps legacy parity (leave not enforced there)', res.result && res.result.ok === true, res);

  const passed = results.filter((r) => r.pass).length;
  console.log(`\n${passed}/${results.length} token checks passed`);
  process.exit(passed === results.length ? 0 : 1);
}
process.exit(0);
