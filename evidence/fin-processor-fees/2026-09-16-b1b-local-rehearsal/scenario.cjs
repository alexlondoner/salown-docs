// FIN-PROCESSOR-FEES B1b — LOCAL REHEARSAL, scripted scenario.
//
// Real: whitecross-site functions/index.js (stripeWebhook handler + the
// wcSettlementSweeper scheduled handler), the settlement module, Stripe signature
// verification, the Firestore EMULATOR (real transactions, real Timestamps), and
// salown-app's real reader. Faked: the Stripe client only.
// This is NOT a Stripe test-mode or staging verification.
'use strict';

const assert = require('node:assert/strict');
const H = require('./harness.cjs');

const F = H.req('./settlements.fakes');
const { ENV, ACCT, START_EPOCH, charge, bt, refund, refundBt, stripeEvent, booking } = F;

const admin = H.req('firebase-admin');
const TENANT = 'tenants/whitecross';
const bookingPath = (id) => `${TENANT}/bookings/${id}`;

const state = { stripe: null };
const webhooks = H.installStripe(() => state.stripe);
const index = H.loadFunctions({ env: ENV });
const db = admin.firestore();

const steps = [];
const NOW = (START_EPOCH + 5 * 86400 + 60) * 1000;
// The events backstop walks closed windows and stops at its page budget, so a
// pass covers a bounded span. A rehearsal runs passes until it has caught up,
// exactly as the 15-minute schedule would over time.
async function sweepUntilCaughtUp(maxPasses = 200) {
  let last = null; let passes = 0;
  for (; passes < maxPasses; passes++) {
    last = await H.sweep(index, db);
    if (!last || last.lastRunError !== "PAGE_LIMIT") break;
  }
  const re = (last && last.refundEvents) || {};
  const lr = re.lastRun || {};
  return { passes: passes + 1, listed: lr.listed ?? null, applied: lr.applied ?? null, error: lr.error ?? null, cursor: re.cursor ?? null, retentionGaps: re.retentionGaps ?? 0 };
}

// A backstop event is only listed if it lies AHEAD of the persisted cursor: after a
// catch-up the cursor sits at now − lag, so fixture events must be stamped just
// after it (the real world stamps them at the moment they happen).
async function nextEventCreated(rewindSeconds = 600) {
  // The sweeper only scans up to now − lag, so right after a catch-up there is no
  // scannable span left and a rehearsal would have to idle out the lag. Rewinding
  // the persisted cursor a few minutes reproduces the normal state between two
  // 15-minute passes: a real window with a real page walk, no code change.
  const ref = db.doc(`${TENANT}/platform/settlementScan`);
  const snap = await ref.get();
  const re = (snap.exists ? snap.data() || {} : {}).refundEvents || {};
  const base = Number.isFinite(re.cursor) ? re.cursor : Math.floor(Date.now() / 1000) - 3600;
  const cursor = base - rewindSeconds;
  await ref.set({ refundEvents: { cursor, page: null } }, { merge: true });
  return cursor + 5;
}

const money = (b) => ({ status: b.status, paymentState: b.paymentState, paidAmount: b.paidAmount, refundedAmount: b.refundedAmount ?? null });
const proj = (b) => (b && b.settlementProjection) || null;

async function wipe() {
  for (const id of ['WEB-1', 'WEB-2']) {
    const ref = db.doc(bookingPath(id));
    const subs = await ref.collection('settlements').get();
    await Promise.all(subs.docs.map((d) => d.ref.delete()));
    await ref.delete().catch(() => {});
  }
  await db.doc(`${TENANT}/platform/settlementScan`).delete().catch(() => {});
}

async function seed() {
  await db.doc(`${TENANT}/settings/settings`).set({ settlementLedgerEnabled: true }, { merge: true });
  await db.doc(bookingPath('WEB-1')).set(booking({ bookingId: 'WEB-1' }));
  await db.doc(bookingPath('WEB-2')).set(booking({ bookingId: 'WEB-2', stripePaymentIntent: 'pi_2' }));
}

async function record(name, extra = {}) {
  const { booking: b, entries } = await H.readLedger(db, bookingPath('WEB-1'));
  const reader = b ? await H.readViaReader(b) : null;
  const step = {
    step: name,
    entries: entries.map((e) => `${e.kind}:${e.id}`),
    projection: proj(b),
    sync: b && b.settlementSync ? { state: b.settlementSync.state, lastError: b.settlementSync.lastError || null } : null,
    refundReview: (b && b.refundReview) || null,
    refundState: b && b.settlementRefundState ? Object.fromEntries(Object.entries(b.settlementRefundState).map(([c, v]) => [c, { generation: v.generation, state: v.state, amountRefunded_m: v.amountRefunded_m, refunds: (v.refunds || []).map((r) => `${r.refundId}:${r.status}`), lastReason: v.lastReason || null }])) : null,
    money: b ? money(b) : null,
    readerFacts: reader ? { status: reader.facts.status, netKind: reader.facts.netKind, net_p: reader.facts.net_p, refunded_p: reader.facts.refunded_p, refundsComplete: reader.facts.refundsComplete, needsReview: reader.facts.needsReview } : null,
    readerAcceptsProjection: reader ? reader.projection !== null : null,
    ...extra,
  };
  steps.push(step);
  console.log(JSON.stringify(step));
  return step;
}

async function main() {
  await wipe();
  await seed();

  // ── 1. capture, fee unknown, then the fee arrives ────────────────────────────
  state.stripe = F.makeStripe({ charges: [charge({ balance_transaction: null })], bts: {} });
  let r = await H.deliver(index, webhooks, stripeEvent('charge.succeeded', charge({ balance_transaction: null }), { id: 'evt_cap' }));
  await record('1a capture, fee unknown', { http: r.status });

  state.stripe = F.makeStripe({ charges: [charge()], bts: { txn_1: bt() } });
  r = await H.deliver(index, webhooks, stripeEvent('charge.updated', charge(), { id: 'evt_fee' }));
  await record('1b fee arrives', { http: r.status });

  // ── 2. partial refund re_1, fee known in the same run ────────────────────────
  const chargeAfterRe1 = charge({ amount_refunded: 1000 });
  state.stripe = F.makeStripe({ charges: [chargeAfterRe1], bts: { txn_1: bt(), txn_re_1: refundBt() }, refunds: [refund()] });
  r = await H.deliver(index, webhooks, stripeEvent('charge.refunded', chargeAfterRe1, { id: 'evt_re1' }));
  const s2 = await record('2 partial refund re_1 (webhook)', { http: r.status });
  assert.equal(s2.projection.settledNetStatus, 'complete', 'a fully observed refund with a known fee must be complete');
  assert.equal(s2.projection.refunded_m, 1000);

  // ── 3. LOST WEBHOOK: re_2 succeeds, no webhook — the events backstop finds it ─
  const chargeAfterRe2 = charge({ amount_refunded: 1600 });
  const re2 = refund({ id: 're_2', amount: 600, balance_transaction: 'txn_re_2', created: START_EPOCH + 5 * 86400 + 20 });
  state.stripe = F.makeStripe({
    charges: [chargeAfterRe2],
    bts: { txn_1: bt(), txn_re_1: refundBt(), txn_re_2: refundBt({ id: 'txn_re_2', source: 're_2', amount: -600, net: -600 }) },
    refunds: [refund(), re2],
    events: [stripeEvent('refund.created', re2, { id: 'evt_bs_re2', created: START_EPOCH + 5 * 86400 + 21 })],
  });
  const sweep1 = await sweepUntilCaughtUp();
  const s3 = await record('3 lost webhook recovered by the events backstop', { sweep: sweep1 });
  assert.equal(s3.projection.refunded_m, 1600, 'the backstop must record re_2 without any webhook');
  assert.equal(s3.projection.settledNetStatus, 'complete');

  // ── 4. a pending refund must drop completeness even with no new REFUNDED entry ─
  //    (the snapshot moves; the ledger does not)
  const evt3At = await nextEventCreated();
  const re3pending = refund({ id: 're_3', amount: 400, status: 'pending', balance_transaction: null, created: START_EPOCH + 5 * 86400 + 30 });
  const chargeWithPending = charge({ amount_refunded: 2000 });
  state.stripe = F.makeStripe({
    charges: [chargeWithPending],
    bts: { txn_1: bt(), txn_re_1: refundBt(), txn_re_2: refundBt({ id: 'txn_re_2', source: 're_2', amount: -600, net: -600 }) },
    refunds: [refund(), re2, re3pending],
    events: [stripeEvent('refund.created', re3pending, { id: 'evt_bs_re3', created: evt3At })],
  });
  const sweep2 = await sweepUntilCaughtUp();
  const s4 = await record('4 pending re_3 seen: no new REFUNDED entry, completeness drops', { sweep: sweep2 });
  assert.notEqual(s4.projection.settledNetStatus, 'complete', 'THE FIXED BUG: a pending refund must not leave the projection complete');
  assert.equal(s4.projection.refunded_m, 1600, 'a pending refund is not money back yet');

  // ── 5. re_3 is canceled: no REFUNDED entry ever, complete again ───────────────
  const evt5At = await nextEventCreated();
  const re3canceled = refund({ id: 're_3', amount: 400, status: 'canceled', balance_transaction: null, created: START_EPOCH + 5 * 86400 + 30 });
  state.stripe = F.makeStripe({
    charges: [charge({ amount_refunded: 1600 })],
    bts: { txn_1: bt(), txn_re_1: refundBt(), txn_re_2: refundBt({ id: 'txn_re_2', source: 're_2', amount: -600, net: -600 }) },
    refunds: [refund(), re2, re3canceled],
    events: [stripeEvent('refund.updated', re3canceled, { id: 'evt_bs_re3c', created: evt5At })],
  });
  const sweep3 = await sweepUntilCaughtUp();
  const s5 = await record('5 re_3 canceled — complete again, no REFUNDED entry for it', { sweep: sweep3 });
  assert.equal(s5.projection.settledNetStatus, 'complete');
  assert.ok(!s5.entries.some((e) => e.endsWith('stripe:re_3')), 're_3 must never have a REFUNDED entry');

  // ── 6. re_1 fails after having succeeded → compensation, money back with us ───
  const evt6At = await nextEventCreated();
  const re1failed = refund({ id: 're_1', status: 'failed', failure_reason: 'declined', failure_balance_transaction: 'txn_re_1_fail' });
  state.stripe = F.makeStripe({
    charges: [charge({ amount_refunded: 600 })],
    bts: { txn_1: bt(), txn_re_1: refundBt(), txn_re_2: refundBt({ id: 'txn_re_2', source: 're_2', amount: -600, net: -600 }) },
    refunds: [re1failed, re2, re3canceled],
    events: [stripeEvent('refund.failed', re1failed, { id: 'evt_bs_re1f', created: evt6At })],
  });
  const sweep4 = await sweepUntilCaughtUp();
  const s6 = await record('6 re_1 failed after succeeding — compensated', { sweep: sweep4 });
  assert.equal(s6.projection.refunded_m, 600, 'a failed refund is no longer money out');
  assert.ok(s6.entries.some((e) => e.startsWith('COMPENSATION:comp:stripe:re_1:')), 'a compensation entry must name the failed refund');

  // ── 7. replay: the same events and another sweep change nothing ───────────────
  const before = await H.readLedger(db, bookingPath('WEB-1'));
  await H.deliver(index, webhooks, stripeEvent('charge.refunded', charge({ amount_refunded: 600 }), { id: 'evt_re1' }));
  await sweepUntilCaughtUp();
  const after = await H.readLedger(db, bookingPath('WEB-1'));
  const s7 = await record('7 replay: webhook + sweep again', {
    entriesBefore: before.entries.length,
    entriesAfter: after.entries.length,
    versionStable: proj(before.booking).version === proj(after.booking).version,
  });
  assert.equal(s7.entriesBefore, s7.entriesAfter, 'a replay must not add entries');
  assert.equal(s7.versionStable, true);

  // ── 8. kill switch off: no Stripe call, no write ──────────────────────────────
  await db.doc(`${TENANT}/settings/settings`).set({ settlementLedgerEnabled: false }, { merge: true });
  state.stripe = F.makeStripe({ charges: [charge({ amount_refunded: 600 })], refunds: [re1failed, re2], events: [stripeEvent('refund.updated', re2, { id: 'evt_bs_off', created: START_EPOCH + 5 * 86400 + 61 })] });
  const offSweep = await H.sweep(index, db);
  const offCalls = state.stripe.calls.length;
  const afterOff = await H.readLedger(db, bookingPath('WEB-1'));
  const s8 = await record('8 kill switch off', { stripeCalls: offCalls, entries: afterOff.entries.length, sweep: offSweep && offSweep.reason ? offSweep.reason : offSweep });
  assert.equal(offCalls, 0, 'the kill switch must be checked before any Stripe call');
  assert.equal(afterOff.entries.length, after.entries.length, 'nothing may be written while the flag is off');

  const scanState = (await db.doc(`${TENANT}/platform/settlementScan`).get()).data() || {};
  const summary = {
    rehearsal: 'B1b local — real Firestore emulator + real handler/sweeper + real reader, FAKE Stripe',
    candidate: process.env.REHEARSAL_CANDIDATE || null,
    steps: steps.length,
    refundEventsCursor: scanState.refundEvents ? { cursor: scanState.refundEvents.cursor, page: scanState.refundEvents.page, retentionGaps: (scanState.refundEvents.retentionGaps || []).length } : null,
    finalProjection: proj((await H.readLedger(db, bookingPath('WEB-1'))).booking),
  };
  console.log(JSON.stringify({ SUMMARY: summary }));
}

main().then(() => process.exit(0), (e) => { console.error('REHEARSAL FAILED:', e && e.stack || e); process.exit(1); });
