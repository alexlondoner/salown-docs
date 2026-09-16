// FIN-PROCESSOR-FEES B1b — LOCAL REHEARSAL HARNESS (infrastructure).
//
// Runs the REAL whitecross-site `functions/index.js` (stripeWebhook handler and the
// wcSettlementSweeper scheduled handler) from a `git archive` of a pinned candidate,
// against the REAL Firestore emulator (real transactions, real Timestamps), with
// Stripe replaced at the module boundary by a scripted client. Stripe signatures
// are computed and verified by the real SDK. Projections are read back through
// salown-app's real reader (`src/utils/settlementFacts.ts`).
//
// Never: network to Stripe, production project, real secrets, deploy.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = process.env.REHEARSAL_FUNCTIONS_DIR;
const READER_TS = process.env.REHEARSAL_READER_TS;
const PROJECT = 'demo-salown-b1b';

// ── safety gates: refuse to run anywhere but a local emulator on a demo project ──
assert.ok(FUNCTIONS_DIR && fs.existsSync(path.join(FUNCTIONS_DIR, 'index.js')), 'REHEARSAL_FUNCTIONS_DIR must point at the archived functions/');
assert.ok(!FUNCTIONS_DIR.includes('/Desktop/alex/'), 'run from a git-archive workspace, never from a repo checkout');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085', 'FIRESTORE_EMULATOR_HOST must be the local emulator');
for (const f of ['.secret.local', '.env', '.env.havuz-44f70', '.env.salown-staging', '.runtimeconfig.json']) {
  assert.ok(!fs.existsSync(path.join(FUNCTIONS_DIR, f)), `secret/env file ${f} present in the workspace — refusing`);
}
process.env.GCLOUD_PROJECT = PROJECT;
process.env.GOOGLE_CLOUD_PROJECT = PROJECT;
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT });
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

const req = (m) => require(require.resolve(m, { paths: [FUNCTIONS_DIR] }));

function installStripe(getClient) {
  const RealStripe = req('stripe');
  const realWebhooks = new RealStripe('sk_live_placeholder').webhooks;
  function FakeStripe(key) { const c = getClient(); c.key = key; c.webhooks = realWebhooks; return c; }
  FakeStripe.resources = RealStripe.resources;
  require.cache[require.resolve('stripe', { paths: [FUNCTIONS_DIR] })].exports = FakeStripe;
  return realWebhooks;
}

function loadFunctions({ env }) {
  process.env.WC_STRIPE_SECRET_KEY = 'sk_live_fake_rehearsal';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake_rehearsal';
  process.env.WC_STRIPE_TEST_SECRET_KEY = '';
  process.env.STRIPE_TEST_WEBHOOK_SECRET = '';
  Object.assign(process.env, env);
  const index = require(path.join(FUNCTIONS_DIR, 'index.js'));
  assert.equal(typeof index.stripeWebhook, 'function', 'stripeWebhook export missing');
  assert.equal(typeof index.wcSettlementSweeper?.run, 'function', 'wcSettlementSweeper.run missing');
  return index;
}

function signedRequest(webhooks, event) {
  const payload = JSON.stringify(event);
  const sig = webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET });
  return { method: 'POST', headers: { 'stripe-signature': sig }, rawBody: Buffer.from(payload), body: event };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.send = (b) => { res.body = b; return res; };
  return res;
}

async function deliver(index, webhooks, event) {
  const res = makeRes();
  await index.stripeWebhook(signedRequest(webhooks, event), res);
  return { status: res.statusCode, body: res.body };
}

// firebase-functions' scheduled wrapper DISCARDS the handler's return value, so a
// pass is measured from what it persisted: platform/settlementScan.
async function sweep(index, db) {
  await index.wcSettlementSweeper.run({ scheduleTime: new Date().toISOString(), jobName: 'rehearsal' });
  const snap = await db.doc('tenants/whitecross/platform/settlementScan').get();
  const state = snap.exists ? snap.data() || {} : {};
  const re = state.refundEvents || {};
  return {
    scanState: state,
    refundEvents: { cursor: re.cursor ?? null, page: re.page ?? null, retentionGaps: (re.retentionGaps || []).length, lastRun: re.lastRun || null },
    lastRunError: (re.lastRun && re.lastRun.error) || null,
  };
}

async function readLedger(db, bookingPath) {
  const [bSnap, eSnap] = await Promise.all([db.doc(bookingPath).get(), db.doc(bookingPath).collection('settlements').get()]);
  const entries = eSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id));
  return { booking: bSnap.data() || null, entries };
}

async function readViaReader(booking) {
  const m = await import(READER_TS);
  const clean = JSON.parse(JSON.stringify(booking, (k, v) => (v && typeof v === 'object' && typeof v.toDate === 'function' ? v.toDate().toISOString() : v)));
  return { projection: m.readProjection(clean.settlementProjection), facts: m.readSettlementFacts(clean) };
}

module.exports = { PROJECT, FUNCTIONS_DIR, req, installStripe, loadFunctions, deliver, sweep, readLedger, readViaReader };
