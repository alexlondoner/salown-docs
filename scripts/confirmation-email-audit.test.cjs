'use strict';
// node --test scripts/confirmation-email-audit.test.cjs
// Pins the pure half of the audit: the verdict ORDER (it must match the trigger
// chain), the sender router, and the source parser that keeps the FORCE list
// from drifting. No Firestore, no credentials.

const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('./confirmation-email-audit.cjs');

const T = ms => ({ toMillis: () => ms }); // Firestore Timestamp stand-in
const NOW = Date.UTC(2026, 8, 4, 12, 0, 0);
const DAY = 86400000;

const confirmedOnline = (over = {}) => ({
  status: 'CONFIRMED', source: 'Salown', clientEmail: 'jamie@example.com',
  createdAt: T(NOW - DAY), startTime: T(NOW + DAY), ...over,
});

test('toMs accepts Timestamp, Date, ISO string, epoch number, {seconds}', () => {
  assert.equal(A.toMs(T(5)), 5);
  assert.equal(A.toMs(new Date(7)), 7);
  assert.equal(A.toMs('2026-09-04T00:00:00Z'), Date.UTC(2026, 8, 4));
  assert.equal(A.toMs(9), 9);
  assert.equal(A.toMs({ seconds: 1, nanoseconds: 500000000 }), 1500);
  assert.equal(A.toMs(null), null);
  assert.equal(A.toMs('not a date'), null);
});

test('maskEmail keeps the first letter and the domain only', () => {
  assert.equal(A.maskEmail('jamie.marshall@gmail.com'), 'j***@gmail.com');
  assert.equal(A.maskEmail(''), '(none)');
  assert.equal(A.maskEmail('nodomain'), 'n***');
});

test('emailable/walk-in mirrors read bookingType FIRST, then source (INCIDENTS 2026-08-04)', () => {
  assert.equal(A.isEmailableBooking({ bookingType: 'booking', source: 'Walk-in' }), true);
  // source Website/Salown is emailable whatever bookingType says — the real gate only
  // short-circuits on bookingType === 'booking' (functions/src/emails/index.ts:111-114)
  assert.equal(A.isEmailableBooking({ bookingType: 'walkin', source: 'Website' }), true);
  assert.equal(A.isEmailableBooking({ bookingType: 'walkin', source: 'Walk-in' }), false);
  assert.equal(A.isEmailableBooking({ source: 'Website' }), true);
  assert.equal(A.isEmailableBooking({ source: 'Salown' }), true);
  assert.equal(A.isEmailableBooking({ source: 'Booksy' }), false);
  assert.equal(A.isWalkInBooking({ source: 'Walk-in' }), true);
  assert.equal(A.isWalkInBooking({ bookingType: 'booking', source: 'Walk-in' }), false);
});

test('routeSender: forced tenant → Brevo even with a full emailConfig; else Gmail only when both fields exist', () => {
  const full = { email: 'x@gmail.com', appPassword: 'p' };
  assert.equal(A.routeSender('whitecross', full, ['whitecross']).via, 'brevo');
  assert.equal(A.routeSender('herohairs', full, ['whitecross']).via, 'gmail');
  assert.equal(A.routeSender('herohairs', { email: 'x@gmail.com' }, ['whitecross']).via, 'brevo');
  assert.equal(A.routeSender('herohairs', {}, ['whitecross']).via, 'brevo');
});

test('parseForceList reads the constant out of the module source, in either quote style', () => {
  assert.deepEqual(A.parseForceList("const FORCE_SALOWN_SENDER_TENANTS = ['whitecross'];"), ['whitecross']);
  assert.deepEqual(A.parseForceList('const FORCE_SALOWN_SENDER_TENANTS = ["a", "b"];'), ['a', 'b']);
  assert.deepEqual(A.parseForceList('const FORCE_SALOWN_SENDER_TENANTS = [];'), []);
  assert.equal(A.parseForceList('nothing here'), null);
});

test('classify: a stamp wins over everything, even a gate that is now off', () => {
  const r = A.classifyBooking(confirmedOnline({ confirmationEmailSentAt: T(NOW - DAY + 1000) }), { gateOff: true, nowMs: NOW });
  assert.equal(r.verdict, 'SENT');
});

test('classify: PENDING is awaiting payment, or expired once expiresAt has passed', () => {
  assert.equal(A.classifyBooking(confirmedOnline({ status: 'PENDING', expiresAt: T(NOW + 600000) }), { nowMs: NOW }).verdict, 'AWAITING_PAYMENT');
  assert.equal(A.classifyBooking(confirmedOnline({ status: 'PENDING', expiresAt: T(NOW - 600000) }), { nowMs: NOW }).verdict, 'PENDING_EXPIRED');
});

test('classify: no clientEmail is checked before emailability and before the gate', () => {
  const r = A.classifyBooking(confirmedOnline({ clientEmail: '', source: 'Walk-in' }), { gateOff: true, nowMs: NOW });
  assert.equal(r.verdict, 'NO_CLIENT_EMAIL');
});

test('classify: a walk-in / aggregator booking is NOT_EMAILABLE by design', () => {
  assert.equal(A.classifyBooking(confirmedOnline({ source: 'Walk-in', bookingType: 'walkin' }), { nowMs: NOW }).verdict, 'NOT_EMAILABLE');
  assert.equal(A.classifyBooking(confirmedOnline({ source: 'Booksy' }), { nowMs: NOW }).verdict, 'NOT_EMAILABLE');
  // the 2026-08-04 shape: panel future booking correctly typed → emailable
  assert.notEqual(A.classifyBooking(confirmedOnline({ source: 'Walk-in', bookingType: 'booking' }), { nowMs: NOW }).verdict, 'NOT_EMAILABLE');
});

test('classify: the tenant toggle explains an otherwise-perfect booking', () => {
  assert.equal(A.classifyBooking(confirmedOnline(), { gateOff: true, nowMs: NOW }).verdict, 'GATE_OFF');
});

test('classify: born-CONFIRMED with a past startTime hits the create trigger future-only guard; a Stripe-confirmed one does not', () => {
  const past = { createdAt: T(NOW - DAY), startTime: T(NOW - DAY - 3600000) };
  assert.equal(A.classifyBooking(confirmedOnline(past), { nowMs: NOW }).verdict, 'PAST_AT_CREATE');
  assert.equal(A.classifyBooking(confirmedOnline({ ...past, stripeSessionId: 'cs_x' }), { nowMs: NOW }).verdict, 'MISSING_CHECK_LOGS');
});

test('classify: bookings older than the stamp (2026-07-13) are not counted as misses', () => {
  const r = A.classifyBooking(confirmedOnline({ createdAt: T(Date.UTC(2026, 6, 1)), startTime: T(Date.UTC(2026, 6, 2)) }), { nowMs: NOW });
  assert.equal(r.verdict, 'PRE_STAMP_ERA');
});

test('classify: every data gate passing with no stamp is the one verdict that sends you to the logs', () => {
  assert.equal(A.classifyBooking(confirmedOnline(), { nowMs: NOW }).verdict, 'MISSING_CHECK_LOGS');
  assert.equal(A.classifyBooking(confirmedOnline({ source: 'Website', stripeSessionId: 'cs_1' }), { nowMs: NOW }).verdict, 'MISSING_CHECK_LOGS');
});

test('summarize dates the break: last stamp vs first unexplained miss created after it', () => {
  const rows = [
    { verdict: 'SENT', stampMs: NOW - 3 * DAY, createdMs: NOW - 3 * DAY },
    { verdict: 'SENT', stampMs: NOW - 2 * DAY, createdMs: NOW - 2 * DAY },
    { verdict: 'MISSING_CHECK_LOGS', createdMs: NOW - 1 * DAY },
    { verdict: 'MISSING_CHECK_LOGS', createdMs: NOW - 0.5 * DAY },
    { verdict: 'NOT_EMAILABLE', createdMs: NOW - 0.2 * DAY },
  ];
  const s = A.summarize(rows);
  assert.equal(s.counts.SENT, 2);
  assert.equal(s.counts.MISSING_CHECK_LOGS, 2);
  assert.equal(s.lastSentMs, NOW - 2 * DAY);
  assert.equal(s.firstMissingMs, NOW - 1 * DAY);
  assert.match(s.reading, /sends stopped/);
});

test('summarize readings: healthy / toggle off / platform-level', () => {
  assert.match(A.summarize([{ verdict: 'SENT', stampMs: 1, createdMs: 1 }]).reading, /healthy/);
  assert.match(A.summarize([{ verdict: 'GATE_OFF', createdMs: 1 }]).reading, /toggle is OFF/);
  assert.match(A.summarize([{ verdict: 'MISSING_CHECK_LOGS', createdMs: 1 }]).reading, /platform-level/);
  assert.match(A.summarize([]).reading, /widen/);
});

test('parseArgs: defaults, overrides, and rejection of junk', () => {
  const d = A.parseArgs(['--tenant', 'whitecross']);
  assert.equal(d.tenant, 'whitecross'); assert.equal(d.days, 14); assert.equal(d.limit, 200); assert.equal(d.json, false);
  const o = A.parseArgs(['--tenant', 'herohairs', '--days', '30', '--limit', '50', '--json', '--key', 'k.json']);
  assert.equal(o.days, 30); assert.equal(o.limit, 50); assert.equal(o.json, true); assert.equal(o.key, 'k.json');
  assert.throws(() => A.parseArgs(['--days', '0']), /positive/);
  assert.throws(() => A.parseArgs(['--bogus']), /unknown argument/);
});

test('readOnlyDb exposes get and query builders only — no write method exists on the facade', () => {
  const calls = [];
  const fakeQuery = { where: () => fakeQuery, orderBy: () => fakeQuery, limit: () => fakeQuery, get: async () => { calls.push('get'); return { docs: [] }; }, set: () => { throw new Error('must not be reachable'); } };
  const fakeDb = { doc: () => ({ get: async () => ({ exists: false }), set: () => { throw new Error('must not be reachable'); } }), collection: () => fakeQuery };
  const db = A.readOnlyDb(fakeDb);
  const q = db.collection('x').where('a', '==', 1).orderBy('a').limit(1);
  for (const m of ['set', 'update', 'delete', 'add', 'create', 'batch', 'runTransaction']) {
    assert.equal(typeof q[m], 'undefined', m);
    assert.equal(typeof db.doc('p')[m], 'undefined', m);
    assert.equal(typeof db[m], 'undefined', m);
  }
  return q.get().then(() => assert.deepEqual(calls, ['get']));
});
