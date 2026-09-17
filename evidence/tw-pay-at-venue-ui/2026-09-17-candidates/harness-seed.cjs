// Local screen-check harness seed — emulator only, synthetic data only.
// (Kept as evidence for TW-PAY-AT-VENUE-UI 2026-09-17; run against the Firestore/Auth
// emulators of project demo-pav. The harness itself lived in a scratch directory.)
'use strict';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'demo-pav';
const path = require('node:path');
const req = require('node:module').createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
const { initializeApp } = req('firebase-admin/app');
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
const { getAuth } = req('firebase-admin/auth');

const PROJECT = 'demo-pav';
if (!PROJECT.startsWith('demo-')) throw new Error('refusing: not a demo project');
initializeApp({ projectId: PROJECT });
const db = getFirestore();
const auth = getAuth();
const T = 'pav-test';

const londonDate = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms));
const londonYmd = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
// London wall clock HH:MM today → Timestamp (BST in September: UTC+1).
function todayAt(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const ymd = londonYmd(Date.now());
  return Timestamp.fromDate(new Date(`${ymd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+01:00`));
}

async function main() {
  const email = 'owner@pav.test';
  let user;
  try { user = await auth.getUserByEmail(email); } catch { user = await auth.createUser({ email, password: 'harness-pass-1', displayName: 'Olivia Owner' }); }
  await auth.setCustomUserClaims(user.uid, { tenantId: T, tenantRole: 'owner' });

  const DATE = londonDate(Date.now());
  const pav = (id, time, over = {}) => ({
    bookingId: id, externalId: id, rawEmailSubject: `You've got a new Treatwell booking (Our Ref. ${id.slice(10)})`,
    clientName: over.clientName, clientEmail: `${id.toLowerCase()}@example.invalid`, clientPhone: '+44 7000 000000',
    serviceId: 'the-full-experience', price: '£40.00', paidAmount: 0, paymentType: 'UNPAID',
    status: 'UNPAID', source: 'Treatwell', treatwellRef: id.slice(10),
    twPaymentMode: 'pay_at_venue', twIsNewCustomer: true, twGrossPrice: 40, twFeePct: 35, twFeeVatPct: 20,
    twFeeAmount: 14, twFeeVat: 2.8, twFeeTotal: 16.8, twNetPayout: 23.2,
    date: DATE, time, duration: 40, startTime: todayAt(time),
    endTime: Timestamp.fromMillis(todayAt(time).toMillis() + 40 * 60000),
    barberId: 'alex', barberName: 'Alex', createdAt: Timestamp.now(), parsedAt: Timestamp.now(),
    ...over,
  });
  const bookings = [
    pav('TREATWELL-T9500001', '18:00', { clientName: 'Awaiting PayAtVenue' }),
    pav('TREATWELL-T9500002', '09:00', { clientName: 'Saved Unpaid AtTill',
      discount: 0, serviceCharge: 0, soldProducts: [], soldAddOns: [] }),
    pav('TREATWELL-T9500003', '11:00', { clientName: 'Cancelled PayAtVenue', status: 'CANCELLED', cancelledAt: Timestamp.now() }),
    pav('TREATWELL-T9500004', '10:00', { clientName: 'CheckedOut PayAtVenue', status: 'CHECKED_OUT',
      paidAmount: 40, paymentMethod: 'CASH', discount: 0, serviceCharge: 0, tip: 0, soldProducts: [], soldAddOns: [],
      checkedOutAt: Timestamp.now() }),
    { bookingId: 'BOOKSY-9500005', externalId: 'BOOKSY-9500005', clientName: 'Confirmed Booksy', clientEmail: 'b5@example.invalid',
      serviceId: 'the-full-experience', price: '£40.00', paidAmount: 10, platformDepositAmount: 10, paymentType: 'DEPOSIT',
      status: 'CONFIRMED', source: 'Booksy', date: DATE, time: '17:00', duration: 40, startTime: todayAt('17:00'),
      endTime: Timestamp.fromMillis(todayAt('17:00').toMillis() + 40 * 60000), barberId: 'alex', barberName: 'Alex', createdAt: Timestamp.now() },
  ];

  const batch = db.batch();
  batch.set(db.doc(`tenants/${T}`), {
    name: 'Pay Venue Test Barbers', shopName: 'Pay Venue Test Barbers', onboardingComplete: true, ownerEmail: email,
    plan: 'pro', features: { treatwellParser: true },
  });
  batch.set(db.doc(`tenants/${T}/settings/settings`), {
    shopName: 'Pay Venue Test Barbers', platforms: { treatwell: { paymentType: 'both' } },
  });
  batch.set(db.doc(`tenants/${T}/staff/${user.uid}`), { name: 'Olivia Owner', email, role: 'owner', active: true });
  batch.set(db.doc(`tenants/${T}/barbers/alex`), { name: 'Alex', email, active: true, status: 'active', color: '#534AB7', order: 1 });
  batch.set(db.doc(`tenants/${T}/services/the-full-experience`), { name: 'The Full Experience', price: 40, duration: 40, active: true, category: 'Standard', order: 1 });
  for (const b of bookings) batch.set(db.doc(`tenants/${T}/bookings/${b.bookingId}`), b);
  await batch.commit();
  console.log(JSON.stringify({ uid: user.uid, date: DATE, bookings: bookings.map((b) => [b.bookingId, b.status, b.time]) }));
}
main().catch((e) => { console.error(e); process.exit(1); });
