// THROWAWAY — content-level zero-write verification over saved snapshots + current emulator updateTime inventory.
import { createRequire } from 'module';
import { readFileSync, writeFileSync } from 'fs';
const require = createRequire('/Users/alish/Desktop/alex/salown-app/functions/package.json');
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const admin = require('firebase-admin');
const app = admin.initializeApp({ projectId: 'demo-c1' });
if (app.options.projectId !== 'demo-c1') process.exit(3);
const db = require('firebase-admin/firestore').getFirestore();
const E = './evidence';
const load = (n) => JSON.parse(readFileSync(`${E}/${n}.json`, 'utf8'));
const pairs = [
  ['S0-before-staff-rerun', 'S1-after-staff-conflict-save', 'S1'],
  ['S1-after-staff-conflict-save', 'S2-after-staff-leave-save', 'S2'],
  ['S2-after-staff-leave-save', 'S3-after-staff-conflict-save-and-checkout', 'S3'],
  ['A0-before-admin', 'A1-after-admin-conflict-save', 'A1'],
  ['A1-after-admin-conflict-save', 'A2-after-admin-leave-save', 'A2'],
  ['A2-after-admin-leave-save', 'A3-after-admin-conflict-save-and-checkout', 'A3'],
  ['O2-after-owner-conflict-save-and-checkout', 'O3-after-owner-blocked', 'O3'],
];
const byId = (arr, k) => Object.fromEntries(arr.map((x) => [x[k], x]));
const cmp = (b, a, k) => {
  const B = byId(b, k), A = byId(a, k);
  const ids = [...new Set([...Object.keys(B), ...Object.keys(A)])];
  const added = ids.filter((i) => !(i in B)), removed = ids.filter((i) => !(i in A));
  const changed = ids.filter((i) => i in B && i in A && JSON.stringify(B[i]) !== JSON.stringify(A[i]));
  return { before: Object.keys(B).length, after: Object.keys(A).length, added, removed, contentChanged: changed };
};
// full document inventory of the tenant subtree, with server update times
async function walk(ref, out) {
  for (const col of await ref.listCollections()) {
    const snap = await col.get();
    for (const d of snap.docs) { out.push({ path: d.ref.path, updateTime: d.updateTime.toDate().toISOString(), createTime: d.createTime.toDate().toISOString() }); await walk(d.ref, out); }
  }
}
const root = await db.doc('tenants/p2ui').get();
const inv = [{ path: 'tenants/p2ui', updateTime: root.updateTime?.toDate().toISOString(), createTime: root.createTime?.toDate().toISOString() }];
await walk(db.doc('tenants/p2ui'), inv);
const collections = [...new Set(inv.slice(1).map((x) => x.path.split('/').slice(0, -1).join('/')))].sort();
const results = pairs.map(([bn, an, id]) => {
  const b = load(bn), a = load(an);
  const winStart = b.capturedAt, winEnd = a.capturedAt;
  const touched = inv.filter((x) => x.updateTime > winStart && x.updateTime < winEnd).map((x) => ({ path: x.path, updateTime: x.updateTime }));
  return {
    scenario: id, before: bn, after: an, window: [winStart, winEnd],
    bookings_projectedFields: cmp(b.bookings, a.bookings, 'docId'),
    bookingRequests_fullDocument: cmp(b.idempotency, a.idempotency, 'id'),
    auditLogs_projectedFields: cmp(b.audits, a.audits, 'id'),
    anyDocInWholeTenantSubtreeUpdatedInWindow: touched,
  };
});
const out = {
  capturedAt: new Date().toISOString(),
  scope: {
    snapshotComparison: {
      'tenants/p2ui/bookings': 'projected fields only: docId, bookingId, barberId, status, source, bookingType, startTime, startLondon, endTime, duration, price, paidAmount, paymentMethod, checkedOutAt, total',
      'tenants/p2ui/bookingRequests': 'full document data',
      'tenants/p2ui/auditLogs': 'projected fields only: id, action, actor, tenantId, target, meta, timestamp',
    },
    updateTimeInventory: 'every document currently present under tenants/p2ui (recursive, all subcollections) plus the tenant root doc; a write inside a window would move that doc\'s updateTime into the window. Blind spots: a document CREATED and then DELETED inside the window, or DELETED inside the window, leaves no trace here; documents outside tenants/p2ui (other tenants, Auth users) are not covered.',
    collectionsPresentNow: collections,
    documentsInventoried: inv.length,
  },
  results,
};
writeFileSync(`${E}/zero-write-content-check.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ collectionsPresentNow: collections, documentsInventoried: inv.length, summary: results.map((r) => ({ s: r.scenario, bookings: [r.bookings_projectedFields.added.length, r.bookings_projectedFields.removed.length, r.bookings_projectedFields.contentChanged.length], idem: [r.bookingRequests_fullDocument.added.length, r.bookingRequests_fullDocument.removed.length, r.bookingRequests_fullDocument.contentChanged.length], audits: [r.auditLogs_projectedFields.added.length, r.auditLogs_projectedFields.removed.length, r.auditLogs_projectedFields.contentChanged.length], touchedInWindow: r.anyDocInWholeTenantSubtreeUpdatedInWindow.map((t) => t.path.replace('tenants/p2ui/', '')) })) }, null, 1));
process.exit(0);
