// THROWAWAY (never committed) — evidence capture for the STAFF-AVAIL-GAP Phase 2 Chrome run.
// Talks ONLY to the local Firestore emulator (127.0.0.1:8080, project demo-c1); refuses otherwise.
//   node p2evidence.mjs snapshot <label>          → evidence/<label>.json + one-line counts
//   node p2evidence.mjs seedBeaConflict           → seeds booking B (Bea 14:00-14:30) for scenario O4
import { createRequire } from 'module';
import { mkdirSync, writeFileSync } from 'fs';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require('firebase-admin');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const app = admin.initializeApp({ projectId: 'demo-c1' });
if (app.options.projectId !== 'demo-c1' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
  console.error('REFUSING: not the local emulator'); process.exit(3);
}
const db = getFirestore();
const T = 'p2ui';
const DIR = '/private/tmp/claude-501/-Users-alish/1b4e7c9f-b90b-4cb4-9da8-c744b257a970/scratchpad/evidence';
mkdirSync(DIR, { recursive: true });
const tsIso = (v) => (v && typeof v.toMillis === 'function' ? new Date(v.toMillis()).toISOString() : v ?? null);
const london = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));

async function snapshot(label) {
  const tenantDoc = await db.doc(`tenants/${T}`).get();
  const bookings = (await db.collection(`tenants/${T}/bookings`).orderBy('startTime').get()).docs.map((d) => {
    const x = d.data();
    return {
      docId: d.id, bookingId: x.bookingId, barberId: x.barberId, status: x.status, source: x.source ?? null,
      bookingType: x.bookingType ?? null, startTime: tsIso(x.startTime), startLondon: x.startTime ? london(x.startTime.toMillis()) : null,
      endTime: tsIso(x.endTime), duration: x.duration ?? null, price: x.price ?? null, paidAmount: x.paidAmount ?? null,
      paymentMethod: x.paymentMethod ?? null, checkedOutAt: tsIso(x.checkedOutAt), total: x.total ?? null,
    };
  });
  const idempotency = (await db.collection(`tenants/${T}/bookingRequests`).get()).docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsIso(d.data().createdAt) }));
  const audits = (await db.collection(`tenants/${T}/auditLogs`).get()).docs.map((d) => {
    const x = d.data();
    return { id: d.id, action: x.action, actor: x.actor ?? null, tenantId: x.tenantId ?? null, target: x.target ?? null, meta: x.meta ?? null, timestamp: tsIso(x.timestamp) };
  });
  const checkedOut = bookings.filter((b) => /CHECKED_OUT|PAID/i.test(String(b.status))).length;
  const out = {
    label, capturedAt: new Date().toISOString(), environment: { projectId: app.options.projectId, firestoreHost: process.env.FIRESTORE_EMULATOR_HOST, tenant: T, tenantName: tenantDoc.data()?.name ?? null },
    counts: { bookings: bookings.length, idempotency: idempotency.length, audits: audits.length, overrideAudits: audits.filter((a) => a.action === 'STAFF_BOOKING_POLICY_OVERRIDE').length, checkedOut },
    bookings, idempotency, audits,
  };
  writeFileSync(`${DIR}/${label}.json`, JSON.stringify(out, null, 2));
  console.log(`${label}: ${JSON.stringify(out.counts)} → evidence/${label}.json`);
}

async function seedBeaConflict() {
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [Y, M, D] = todayKey.split('-').map(Number);
  const off = (ms) => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)); const g = (t) => Number(p.find((x) => x.type === t).value); return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000) / 60000; };
  const lms = (h, m) => { const n = Date.UTC(Y, M - 1, D, h, m); return n - off(n - off(n) * 60000) * 60000; };
  const ref = await db.collection(`tenants/${T}/bookings`).add({
    bookingId: 'SEED-BEA-B', status: 'CONFIRMED', barberId: 'bea', barberName: 'Bea', barber: 'bea', clientName: 'Seed B',
    serviceId: 'svc1', serviceName: 'Haircut', duration: 30, price: 20, source: 'Walk-in', bookingType: 'walkin',
    startTime: Timestamp.fromMillis(lms(14, 0)), endTime: Timestamp.fromMillis(lms(14, 30)), createdAt: Timestamp.now(),
  });
  // Injected-C window, printed so the in-page stub writes exactly this (Bea 14:15-14:45).
  console.log(JSON.stringify({ seededB: ref.id, cStartIso: new Date(lms(14, 15)).toISOString(), cEndIso: new Date(lms(14, 45)).toISOString() }));
}

const [mode, label] = process.argv.slice(2);
if (mode === 'snapshot') await snapshot(label);
else if (mode === 'seedBeaConflict') await seedBeaConflict();
else console.error('usage: snapshot <label> | seedBeaConflict');
process.exit(0);
