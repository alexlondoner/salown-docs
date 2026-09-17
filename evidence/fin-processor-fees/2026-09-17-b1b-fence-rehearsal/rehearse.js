'use strict';
/**
 * FIN-B1B-RECENCY — local Firestore EMULATOR rehearsal.
 *
 * Real Firestore semantics (transactions, contention, retries) against the
 * emulator; Stripe is entirely the fake from settlements.fakes.js. No production,
 * no real Stripe, no deploy. Project id starts with `demo-` so the Admin SDK
 * refuses to reach any real project.
 *
 * Scenarios (owner-requested):
 *   1  writer race, BOTH commit orders                (fresh-first, stale-first)
 *   1c a genuinely parallel race (Promise.all)
 *   2  fencing after an UNCHANGED snapshot
 *   3  retry exhaustion → marker → the sweeper takes over
 *   4  two charges of one booking keep both totals
 *   5  ordinary pending → succeeded completes with NO human intervention
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8099';
process.env.GOOGLE_CLOUD_PROJECT = 'demo-b1b-recency';

const assert = require('node:assert/strict');
const FN = '/Users/alish/Desktop/alex/whitecross-site/functions';
const admin = require(`${FN}/node_modules/firebase-admin`);
const S = require(`${FN}/settlements`);
const F = require(`${FN}/settlements.fakes`);

const { makeStripe, charge, bt, refund, refundBt, booking, ACCT, CONFIG, START_EPOCH } = F;
const BK = S.BOOKINGS_COLLECTION;

admin.initializeApp({ projectId: 'demo-b1b-recency' });
const db = admin.firestore();

const NOW = Date.UTC(2026, 8, 7, 12, 0, 0);
const at = (m) => NOW + m * 60_000;
const ts = () => admin.firestore.Timestamp.now();
const quiet = { warn() {}, error() {}, log() {} };
const evt = (type, object, id = 'evt_x') => ({ id, type, livemode: true, data: { object } });
const chargeRefundedEvt = (id = 'evt_ref', refundIds = ['re_1']) => evt('charge.refunded', charge({ amount_refunded: 999_999, refunds: { object: 'list', data: refundIds.map((r) => ({ id: r })) } }), id);
const args = (stripe, over = {}) => ({ db, stripe, config: CONFIG, timestampNow: ts, logger: quiet, ...over });

const bookingRef = (id) => db.doc(`${BK}/${id}`);
const getBooking = async (id) => (await bookingRef(id).get()).data() || {};
const getEntries = async (id) => (await db.collection(`${BK}/${id}/settlements`).get()).docs.map((d) => d.data());
const entryIds = async (id) => (await getEntries(id)).map((e) => e.entryId).sort();
const rstate = async (id, chargeId = 'ch_1') => ((await getBooking(id))[S.REFUND_STATE_FIELD] || {})[chargeId] || null;

async function wipe() {
  await db.recursiveDelete(db.doc(`tenants/${S.TENANT_ID}`));
  await db.doc(S.SETTINGS_DOC).set({ settlementLedgerEnabled: true }, { merge: true });
}

async function seedCaptured(id = 'b1', stripe, over = {}) {
  await bookingRef(id).set(booking(over));
  const r = await S.onStripeEvent({ ...args(stripe), event: evt('charge.succeeded', charge(over.chargeOver || {}), `evt_cap_${id}`), nowMs: NOW });
  assert.equal(r.applied, true, 'capture recorded');
}

const results = [];
async function scenario(name, fn) {
  await wipe();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err: err && err.message });
    console.log(`FAIL  ${name}\n      ${err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n      ') : err}`);
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`emulator: ${process.env.FIRESTORE_EMULATOR_HOST}  project: demo-b1b-recency\n`);

  // 1 · writer race, fresh read commits first → the stale worker is fenced and writes nothing
  await scenario('1a  race, fresh-first: the stale worker is fenced and writes NOTHING', async () => {
    const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
    await seedCaptured('b1', stripe);
    stripe.addRefund(refund({ status: 'pending' }));
    const A = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });
    stripe.updateRefund('re_1', { status: 'succeeded' });
    const B = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });

    const win = await S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: B.items, refundFences: B.fences, accountId: ACCT, config: CONFIG, recordedBy: 'wcSettlementSweeper', nowMs: at(2), timestampNow: ts });
    assert.equal(win.applied, true);
    const idsAfterWin = await entryIds('b1');
    const genAfterWin = (await rstate('b1')).generation;

    const late = await S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: A.items, refundFences: A.fences, accountId: ACCT, config: CONFIG, recordedBy: 'stripe-webhook', nowMs: at(3), timestampNow: ts });
    assert.equal(late.reason, S.SREASON.REFUND_FENCED, 'the stale worker is fenced');
    assert.deepEqual(await entryIds('b1'), idsAfterWin, 'no entry written by the fenced worker');
    assert.equal((await rstate('b1')).generation, genAfterWin, 'no generation bump');
    const b = await getBooking('b1');
    assert.equal(b.settlementProjection.refunded_m, 1000);
    assert.equal(b.settlementProjection.settledNetStatus, 'complete');
  });

  // 1b · the other order: the OLDER read commits first, the newer worker is fenced,
  //      and the lost work is redone from a fresh read (no webhook redelivery)
  await scenario('1b  race, stale-first: the newer worker is fenced, the work is redone from a fresh read', async () => {
    const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
    await seedCaptured('b1', stripe);
    stripe.addRefund(refund({ status: 'pending' }));
    const A = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });
    stripe.updateRefund('re_1', { status: 'succeeded' });
    const B = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });

    const first = await S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: A.items, refundFences: A.fences, accountId: ACCT, config: CONFIG, recordedBy: 'stripe-webhook', nowMs: at(2), timestampNow: ts });
    assert.equal(first.applied, true);
    assert.equal((await getEntries('b1')).filter((e) => e.kind === 'REFUNDED').length, 0, 'a pending refund is not money yet');

    const fenced = await S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: B.items, refundFences: B.fences, accountId: ACCT, config: CONFIG, recordedBy: 'wcSettlementSweeper', nowMs: at(3), timestampNow: ts });
    assert.equal(fenced.reason, S.SREASON.REFUND_FENCED);
    assert.equal((await rstate('b1')).generation, 1);

    const redo = await S.recordSettlementWithRefunds(db, { bookingRef: bookingRef('b1'), stripe, accountId: ACCT, config: CONFIG, recordedBy: 'wcSettlementSweeper', nowMs: at(4), timestampNow: ts, force: true, logger: quiet });
    assert.equal(redo.applied, true);
    assert.equal((await rstate('b1')).generation, 2);
    const b = await getBooking('b1');
    assert.equal(b.settlementProjection.refunded_m, 1000);
    assert.equal(b.settlementProjection.settledNetStatus, 'complete');
    assert.equal(b.settlementSync.state, 'done');
  });

  // 1c · a genuinely parallel race on one booking: real transaction contention
  await scenario('1c  parallel race: exactly one reconciliation wins, the ledger is written once', async () => {
    const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
    await seedCaptured('b1', stripe);
    stripe.addRefund(refund());
    const A = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });
    const B = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });
    const common = { accountId: ACCT, config: CONFIG, timestampNow: ts };
    const [ra, rb] = await Promise.all([
      S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: A.items, refundFences: A.fences, recordedBy: 'stripe-webhook', nowMs: at(2), ...common }),
      S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: B.items, refundFences: B.fences, recordedBy: 'wcSettlementSweeper', nowMs: at(2), ...common }),
    ]);
    const outcomes = [ra, rb];
    assert.equal(outcomes.filter((r) => r.applied).length, 1, 'exactly one applied');
    assert.equal(outcomes.filter((r) => r.reason === S.SREASON.REFUND_FENCED).length, 1, 'the other is fenced');
    const entries = await getEntries('b1');
    assert.equal(entries.filter((e) => e.kind === 'REFUNDED').length, 1, 'the refund is recorded exactly once');
    assert.equal((await rstate('b1')).generation, 1);
    const b = await getBooking('b1');
    assert.equal(b.settlementProjection.refunded_m, 1000);
    assert.equal(b.settlementProjection.version, entries.length);
  });

  // 2 · fencing after an UNCHANGED snapshot (the generation-always-advances rule)
  await scenario('2   fencing after an unchanged snapshot: an identical re-read still fences the slow worker', async () => {
    const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
    await seedCaptured('b1', stripe);
    stripe.addRefund(refund());
    await S.recordSettlementWithRefunds(db, { bookingRef: bookingRef('b1'), stripe, accountId: ACCT, config: CONFIG, recordedBy: 'stripe-webhook', nowMs: at(1), timestampNow: ts, force: true, logger: quiet });
    assert.equal((await rstate('b1')).generation, 1);

    // a slow worker takes the fence now …
    const slow = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });
    // … meanwhile another worker reconciles with an IDENTICAL view
    const same = await S.recordSettlementWithRefunds(db, { bookingRef: bookingRef('b1'), stripe, accountId: ACCT, config: CONFIG, recordedBy: 'wcSettlementSweeper', nowMs: at(2), timestampNow: ts, force: true, logger: quiet });
    assert.equal(same.applied, true, 'an identical read is still an accepted reconciliation');
    assert.equal((await rstate('b1')).generation, 2, 'and it advances the generation');
    const idsBefore = await entryIds('b1');

    const late = await S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: slow.items, refundFences: slow.fences, accountId: ACCT, config: CONFIG, recordedBy: 'stripe-webhook', nowMs: at(3), timestampNow: ts });
    assert.equal(late.reason, S.SREASON.REFUND_FENCED, 'no generation gap for the slow worker to slip through');
    assert.deepEqual(await entryIds('b1'), idsBefore);
    assert.equal((await rstate('b1')).generation, 2);
  });

  // 3 · retry exhaustion → durable marker → the sweeper takes the work over
  await scenario('3   retry exhaustion: no partial write, a durable marker, then the sweeper completes it', async () => {
    const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
    await seedCaptured('b1', stripe);
    stripe.addRefund(refund());
    // a competitor moves the generation while every attempt is in flight
    const origList = stripe.refunds.list.bind(stripe.refunds);
    let bumps = 0;
    stripe.refunds.list = async (params) => {
      const res = await origList(params);
      if (bumps <= S.MAX_REFUND_FENCE_RETRIES) {
        bumps++;
        await bookingRef('b1').set({ [S.REFUND_STATE_FIELD]: { ch_1: { generation: 100 + bumps } } }, { merge: true });
      }
      return res;
    };
    const r = await S.recordSettlementWithRefunds(db, { bookingRef: bookingRef('b1'), stripe, accountId: ACCT, config: CONFIG, recordedBy: 'stripe-webhook', nowMs: at(2), timestampNow: ts, force: true, logger: quiet });
    assert.equal(r.reason, S.SREASON.REFUND_FENCED, 'every attempt lost the race');
    assert.equal((await getEntries('b1')).filter((e) => e.kind === 'REFUNDED').length, 0, 'no partial money fact');
    let b = await getBooking('b1');
    assert.equal(b.settlementSync.lastError, S.SREASON.REFUND_FENCED, 'a durable retry marker');
    assert.ok(b.settlementSync.nextAttemptAt, 'and it is due for the sweeper');
    assert.equal(S.needsRefundRead(b), true);

    // the competition stops; the sweeper's due pass takes the work over
    stripe.refunds.list = origList;
    const due = Date.parse(b.settlementSync.nextAttemptAt) + 1;
    const sweep = await S.sweep(args(stripe, { nowMs: due, maxPages: 0 }));
    assert.equal(sweep.applied, 1, 'the sweeper redid the work from a fresh read');
    b = await getBooking('b1');
    assert.equal((await getEntries('b1')).filter((e) => e.kind === 'REFUNDED').length, 1);
    assert.equal(b.settlementProjection.refunded_m, 1000);
    assert.equal(b.settlementProjection.settledNetStatus, 'complete');
    assert.equal(b.settlementSync.state, 'done');
  });

  // 4 · two charges of one booking: independent fences, both totals kept
  await scenario('4   two charges on one booking: independent generations, both totals kept', async () => {
    const c2 = charge({ id: 'ch_2', balance_transaction: 'txn_2', payment_intent: 'pi_2' });
    const stripe = makeStripe({
      charges: [charge(), c2],
      bts: { txn_1: bt(), txn_2: bt({ id: 'txn_2', source: 'ch_2' }), txn_re_1: refundBt(), txn_re_2: refundBt({ id: 'txn_re_2', source: 're_2', amount: -500, net: -500 }) },
    });
    await bookingRef('b1').set(booking());
    await S.onStripeEvent({ ...args(stripe), event: evt('charge.succeeded', charge(), 'e1'), nowMs: NOW });
    await S.onStripeEvent({ ...args(stripe), event: evt('checkout.session.completed', { id: 'cs_2', payment_intent: 'pi_2', payment_status: 'paid', metadata: { bookingDocId: 'b1', tenantId: 'whitecross' } }, 'e2'), nowMs: NOW });
    stripe.addRefund(refund());
    stripe.addRefund(refund({ id: 're_2', charge: 'ch_2', payment_intent: 'pi_2', amount: 500, balance_transaction: 'txn_re_2' }));

    const one = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_1' }), { force: true });
    const two = await S.readRefundsForBooking(db, stripe, bookingRef('b1'), await S.fetchCharges(stripe, { chargeId: 'ch_2' }), { force: true });
    const common = { accountId: ACCT, config: CONFIG, timestampNow: ts, recordedBy: 'stripe-webhook' };
    const [r1, r2] = await Promise.all([
      S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: one.items, refundFences: one.fences, nowMs: at(2), ...common }),
      S.recordSettlement(db, { bookingRef: bookingRef('b1'), charges: two.items, refundFences: two.fences, nowMs: at(3), ...common }),
    ]);
    assert.equal(r1.applied, true, 'ch_1 applied');
    assert.equal(r2.applied, true, 'ch_2 was not fenced by ch_1');
    assert.equal((await rstate('b1', 'ch_1')).generation, 1);
    assert.equal((await rstate('b1', 'ch_2')).generation, 1);
    const p = (await getBooking('b1')).settlementProjection;
    assert.equal(p.captures, 2);
    assert.equal(p.gross_m, 6400);
    assert.equal(p.refunded_m, 1500, 'both refunds are in the total');
    assert.equal(p.settledNetStatus, 'complete');
    assert.equal(p.settledNet_m, 6400 - 136 - 1500);
  });

  // 5 · the ordinary flow must finish by itself
  await scenario('5   pending → succeeded completes with NO human intervention', async () => {
    const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
    await seedCaptured('b1', stripe);
    stripe.addRefund(refund({ status: 'pending' }));
    await S.onStripeEvent({ ...args(stripe), event: chargeRefundedEvt('evt_r1'), nowMs: at(1) });
    let b = await getBooking('b1');
    assert.equal((await getEntries('b1')).filter((e) => e.kind === 'REFUNDED').length, 0, 'pending is not money');
    assert.equal(b.settlementSync.lastError, S.SREASON.REFUND_PENDING);
    assert.equal((await rstate('b1')).state, 'ok', 'an in-flight refund is normal, not a recheck');

    stripe.updateRefund('re_1', { status: 'succeeded' });
    await S.onStripeEvent({ ...args(stripe), event: chargeRefundedEvt('evt_r2'), nowMs: at(2) });
    b = await getBooking('b1');
    assert.equal((await getEntries('b1')).filter((e) => e.kind === 'REFUNDED').length, 1);
    assert.equal(b.settlementProjection.refunded_m, 1000);
    assert.equal(b.settlementProjection.settledNetStatus, 'complete');
    assert.equal(b.settlementProjection.settledNet_m, 3132 - 1000);
    assert.equal(b.settlementSync.state, 'done');
    assert.equal((await rstate('b1')).state, 'ok');
    assert.equal(b.refundReview, undefined, 'no review was raised');
    assert.equal(b.paymentNeedsReview, undefined, 'and no human flag');
    // the money fields the confirmation owns are untouched
    assert.equal(b.paymentState, 'PAID');
    assert.equal(b.paidAmount, 32);
  });

  // a sample of what the rehearsal leaves behind, for the report
  await wipe();
  const stripe = makeStripe({ charges: [charge()], bts: { txn_1: bt(), txn_re_1: refundBt() } });
  await seedCaptured('b1', stripe);
  stripe.addRefund(refund());
  await S.onStripeEvent({ ...args(stripe), event: chargeRefundedEvt('evt_sample'), nowMs: at(1) });
  const sample = await getBooking('b1');
  console.log('\n--- persisted shape (booking b1) ---');
  console.log(JSON.stringify({
    settlementRefundState: sample[S.REFUND_STATE_FIELD],
    settlementSync: sample.settlementSync,
    settlementProjection: sample.settlementProjection,
  }, null, 2));
  console.log('--- ledger entry ids ---');
  console.log((await entryIds('b1')).join('\n'));

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => { console.error('rehearsal crashed:', err); process.exitCode = 1; });
