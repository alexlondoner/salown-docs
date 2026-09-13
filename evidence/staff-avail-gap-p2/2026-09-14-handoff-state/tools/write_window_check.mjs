// THROWAWAY — which documents under tenants/p2ui were created/updated inside each WRITING scenario's window.
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require('firebase-admin');
const app = admin.initializeApp({ projectId: 'demo-c1' });
if (app.options.projectId !== 'demo-c1') process.exit(3);
const db = require('firebase-admin/firestore').getFirestore();
const load = (n) => JSON.parse(readFileSync(`./evidence/${n}.json`, 'utf8'));
async function walk(ref, out) {
  for (const col of await ref.listCollections()) {
    for (const d of (await col.get()).docs) { out.push({ path: d.ref.path.replace('tenants/p2ui/', ''), createTime: d.createTime.toDate().toISOString(), updateTime: d.updateTime.toDate().toISOString(), data: d.data() }); await walk(d.ref, out); }
  }
}
const inv = []; await walk(db.doc('tenants/p2ui'), inv);
const windows = [
  ['O1b', 'O1-attempt1-aborted-page-navigated', 'O1b-after-owner-conflict-save'],
  ['O2', 'O1b-after-owner-conflict-save', 'O2-after-owner-conflict-save-and-checkout'],
  ['O4', 'O4-before-owner-changed-conflict', 'O4-after-owner-changed-conflict'],
];
const summarize = (x) => x.path.startsWith('bookings/') ? { status: x.data.status, bookingId: x.data.bookingId } : x.path.startsWith('auditLogs/') ? { action: x.data.action } : x.path.startsWith('bookingRequests/') ? { op: x.data.op } : { keys: Object.keys(x.data).sort() };
const results = windows.map(([id, b, a]) => {
  const [s, e] = [load(b).capturedAt, load(a).capturedAt];
  const touched = inv.filter((x) => (x.updateTime > s && x.updateTime < e) || (x.createTime > s && x.createTime < e));
  return { scenario: id, window: [s, e], touched: touched.map((x) => ({ path: x.path, created: x.createTime > s && x.createTime < e, updated: x.updateTime > s && x.updateTime < e, ...summarize(x) })) };
});
const o2 = inv.find((x) => x.path.startsWith('bookings/') && x.data.bookingId && results[1].touched.some((t) => t.path === x.path && t.status === 'CHECKED_OUT'));
const out = {
  capturedAt: new Date().toISOString(),
  scope: 'documents currently under tenants/p2ui (recursive). Created-then-deleted or deleted documents, other tenants, Auth and anything outside Firestore are NOT covered.',
  collectionsPresentNow: [...new Set(inv.map((x) => x.path.split('/').slice(0, -1).join('/')))].sort(),
  results,
  o2CheckedOutBookingFieldNames: o2 ? Object.keys(o2.data).sort() : null,
  o2CheckedOutBookingPaymentFields: o2 ? Object.fromEntries(Object.entries(o2.data).filter(([k]) => /paid|payment|checkedOut|receipt|tip|discount|total|loyalty|points|status|price|soldProducts|soldAddOns/i.test(k)).map(([k, v]) => [k, v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v])) : null,
};
writeFileSync('./evidence/write-window-side-effects.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ collectionsPresentNow: out.collectionsPresentNow, results: results.map((r) => ({ s: r.scenario, touched: r.touched.map((t) => `${t.path} c=${t.created} u=${t.updated} ${t.status || t.action || t.op || ''}`) })), o2PaymentFields: out.o2CheckedOutBookingPaymentFields }, null, 1));
process.exit(0);
