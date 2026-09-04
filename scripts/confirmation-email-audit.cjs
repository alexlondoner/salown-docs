#!/usr/bin/env node
// confirmation-email-audit.cjs — READ ONLY.
//
// Answers, from booking DATA rather than log-digging, the question the owner asks
// when a customer says "I never got my confirmation":
//
//     For each recent online/scheduled booking of a tenant: did the confirmation
//     email go out, and if not, WHICH gate in the trigger chain stopped it?
//
// It exists because INCIDENTS.md 2026-08-04 and 2026-06-26 both spent their first
// hour re-deriving the same table by hand. The G1 observability stamp
// (`confirmationEmailSentAt`, written by `_salownSendConfirmationEmail` on every
// successful send since `56c8e5e`, 2026-07-13) makes the table mechanical.
//
// ── WHAT IT READS ───────────────────────────────────────────────────────────
//   tenants/{tid}                          salon name only
//   tenants/{tid}/settings/settings        emailConfirmationEnabled (the owner toggle)
//   tenants/{tid}/settings/emailConfig     presence of email/appPassword (never printed)
//   tenants/{tid}/bookings                 createdAt >= now - days, newest first
//   tenants/{tid}/emailEvents              Brevo webhook: blocked / spam / bounce
//   <app-dir>/functions/src/emails/index.ts  FORCE_SALOWN_SENDER_TENANTS (parsed, not
//                                            re-typed, so this script cannot drift)
//
// ── WHAT IT NEVER DOES ──────────────────────────────────────────────────────
// It writes nothing. The Firestore handle is wrapped in a facade exposing `get`
// and query builders only; `set`/`update`/`delete`/`add`/batch/transaction do not
// exist on it. Customer emails are MASKED in the output. Document ids are printed
// in FULL on purpose — they are what you paste into `functions:log` next, and a
// masked id must never be fed back into a command (INCIDENTS 2026-08-03).
//
// ── USAGE ───────────────────────────────────────────────────────────────────
//   node scripts/confirmation-email-audit.cjs --tenant whitecross
//   node scripts/confirmation-email-audit.cjs --tenant herohairs --days 30 --limit 300
//
//   --app-dir <path>   salown-app checkout (default: ../salown-app next to this repo).
//                      Supplies firebase-admin (functions/node_modules) and the
//                      email module source for the sender constant.
//   --key <path>       service-account JSON. Otherwise GOOGLE_APPLICATION_CREDENTIALS,
//                      otherwise <app-dir>/../salown-panel/serviceAccountKey.json
//                      (the house convention in salown-app/scripts/securityAudit.cjs).
//   --json             machine-readable output instead of the table.
//
// The pure parts (classifier, sender router, parsers) are exported and covered by
// confirmation-email-audit.test.cjs; run `node --test scripts/confirmation-email-audit.test.cjs`.

'use strict';

const fs = require('fs');
const path = require('path');

// ── constants mirrored from the trigger chain (each cites its source line) ─────

// functions/src/emails/index.ts — `_salownSendConfirmationEmail` stamps this on
// every successful send. First shipped in `56c8e5e` (2026-07-13); bookings older
// than that legitimately carry no stamp.
const STAMP_FIELD = 'confirmationEmailSentAt';
const STAMP_SINCE_MS = Date.UTC(2026, 6, 13); // 2026-07-13

// Fallback only. The real value is parsed out of the app source at run time.
const FORCE_SALOWN_SENDER_FALLBACK = ['whitecross'];

// ── pure helpers ─────────────────────────────────────────────────────────────

/** Firestore Timestamp | Date | ISO string | epoch number → ms, or null. */
function toMs(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  return null;
}

function iso(ms) { return ms == null ? '—' : new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + 'Z'; }

/** a***@domain — enough to recognise a customer, never enough to email them. */
function maskEmail(e) {
  const s = String(e || '').trim();
  if (!s) return '(none)';
  const at = s.indexOf('@');
  if (at <= 0) return s[0] + '***';
  return s[0] + '***@' + s.slice(at + 1);
}

// Mirror of `_isWalkInBooking` — functions/src/emails/index.ts:98-104.
function isWalkInBooking(data) {
  if (data.bookingType === 'walkin') return true;
  if (data.bookingType === 'booking') return false;
  return String(data.source || '').toLowerCase() === 'walk-in';
}

// Mirror of `_isEmailableBooking` — functions/src/emails/index.ts:111-114.
// bookingType is read FIRST and only then source (the 2026-08-04 incident).
function isEmailableBooking(data) {
  if (data.bookingType === 'booking') return true;
  return ['website', 'salown'].includes(String(data.source || '').toLowerCase());
}

// Mirror of `_sendCustomerEmail` routing — functions/src/emails/index.ts:67-75.
function routeSender(tenantId, emailCfg, forceList) {
  if ((forceList || []).includes(tenantId)) return { via: 'brevo', reason: 'FORCE_SALOWN_SENDER_TENANTS' };
  if (emailCfg && emailCfg.email && emailCfg.appPassword) return { via: 'gmail', reason: 'emailConfig complete' };
  return { via: 'brevo', reason: 'emailConfig empty' };
}

/** Pull FORCE_SALOWN_SENDER_TENANTS out of the email module source. */
function parseForceList(source) {
  const m = /const\s+FORCE_SALOWN_SENDER_TENANTS\s*=\s*\[([^\]]*)\]/.exec(String(source || ''));
  if (!m) return null;
  return m[1].split(',').map(s => s.trim().replace(/^['"`]|['"`]$/g, '')).filter(Boolean);
}

/**
 * The verdict for one booking, in the ORDER the triggers evaluate their guards.
 *
 * ctx.gateOff — tenant settings.emailConfirmationEnabled === false
 * ctx.nowMs   — injected for tests
 */
function classifyBooking(b, ctx) {
  const now = ctx && ctx.nowMs != null ? ctx.nowMs : Date.now();
  const status = String(b.status || '').toUpperCase();
  const stampMs = toMs(b[STAMP_FIELD]);
  const createdMs = toMs(b.createdAt);
  const startMs = toMs(b.startTime);
  const expiresMs = toMs(b.expiresAt);

  if (stampMs != null) return { verdict: 'SENT', detail: `stamped ${iso(stampMs)}` };

  if (status === 'PENDING') {
    if (expiresMs != null && expiresMs < now) return { verdict: 'PENDING_EXPIRED', detail: 'never paid; nothing to confirm' };
    return { verdict: 'AWAITING_PAYMENT', detail: 'PENDING — confirmation is sent on PENDING→CONFIRMED' };
  }

  if (!b.clientEmail) return { verdict: 'NO_CLIENT_EMAIL', detail: 'both triggers return before sending' };

  if (!isEmailableBooking(b)) {
    const kind = isWalkInBooking(b) ? 'walk-in' : `source=${b.source || '?'}`;
    return { verdict: 'NOT_EMAILABLE', detail: `${kind} bookingType=${b.bookingType || '—'} — by design (_isEmailableBooking)` };
  }

  if (status !== 'CONFIRMED') return { verdict: 'STATUS_' + (status || 'EMPTY'), detail: 'no stamp and not CONFIRMED — was it ever confirmed?' };

  if (ctx && ctx.gateOff) return { verdict: 'GATE_OFF', detail: 'settings.emailConfirmationEnabled === false (Settings → Notifications)' };

  // The onCreate trigger refuses a booking already in the past at creation
  // (functions/src/index.ts, salownBookingConfirmationTrigger). The onUpdate
  // path has no such guard, so this only applies to bookings born CONFIRMED.
  const bornConfirmed = !b.stripeSessionId;
  if (bornConfirmed && startMs != null && createdMs != null && startMs <= createdMs) {
    return { verdict: 'PAST_AT_CREATE', detail: 'startTime <= createdAt — create trigger future-only guard' };
  }

  if (createdMs != null && createdMs < STAMP_SINCE_MS) return { verdict: 'PRE_STAMP_ERA', detail: 'created before 56c8e5e (2026-07-13); stamp did not exist' };

  return { verdict: 'MISSING_CHECK_LOGS', detail: 'every data gate passes — the send itself failed or the trigger did not run' };
}

/** Counts, plus the two timestamps that date the break. */
function summarize(rows) {
  const counts = {};
  let lastSentMs = null;
  const missing = [];
  for (const r of rows) {
    counts[r.verdict] = (counts[r.verdict] || 0) + 1;
    if (r.verdict === 'SENT' && r.stampMs != null && (lastSentMs == null || r.stampMs > lastSentMs)) lastSentMs = r.stampMs;
    if (r.verdict === 'MISSING_CHECK_LOGS' || r.verdict === 'GATE_OFF') missing.push(r);
  }
  const missingAfterLastSent = missing.filter(r => lastSentMs == null || (r.createdMs != null && r.createdMs > lastSentMs));
  let firstMissingMs = null;
  for (const r of missingAfterLastSent) if (r.createdMs != null && (firstMissingMs == null || r.createdMs < firstMissingMs)) firstMissingMs = r.createdMs;

  let reading;
  const nMissing = (counts.MISSING_CHECK_LOGS || 0) + (counts.GATE_OFF || 0);
  if (rows.length === 0) reading = 'no bookings in the window — widen --days';
  else if (nMissing === 0) reading = 'every emailable CONFIRMED booking in the window is stamped — the send path is healthy; the report is about content, delivery (spam) or a booking outside this window';
  else if (counts.GATE_OFF) reading = 'the tenant toggle is OFF — every remaining booking is explained by it; check who flipped it before anything else';
  else if (!counts.SENT) reading = 'nothing stamped in the whole window — a platform-level cause (trigger not firing, BREVO_API_KEY, Brevo account/quota), not one booking';
  else reading = `sends stopped: last stamp ${iso(lastSentMs)}, first unexplained miss created ${iso(firstMissingMs)} — look at what changed between those two instants`;

  return { counts, lastSentMs, firstMissingMs, reading };
}

function parseArgs(argv) {
  const out = { tenant: null, days: 14, limit: 200, appDir: null, key: null, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--tenant') out.tenant = next();
    else if (a === '--days') out.days = Number(next());
    else if (a === '--limit') out.limit = Number(next());
    else if (a === '--app-dir') out.appDir = next();
    else if (a === '--key') out.key = next();
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!Number.isFinite(out.days) || out.days <= 0) throw new Error('--days must be a positive number');
  if (!Number.isFinite(out.limit) || out.limit <= 0) throw new Error('--limit must be a positive number');
  return out;
}

// ── read-only facade ─────────────────────────────────────────────────────────
// Not an `if (dryRun)`: the write methods are simply absent from the object graph.
function readOnlyDb(db) {
  const wrapQuery = q => ({
    where: (...a) => wrapQuery(q.where(...a)),
    orderBy: (...a) => wrapQuery(q.orderBy(...a)),
    limit: (...a) => wrapQuery(q.limit(...a)),
    get: () => q.get(),
  });
  return {
    doc: p => ({ get: () => db.doc(p).get() }),
    collection: p => wrapQuery(db.collection(p)),
  };
}

// ── wiring ───────────────────────────────────────────────────────────────────

function resolveAppDir(explicit) {
  const candidates = [explicit, path.resolve(__dirname, '..', '..', 'salown-app'), path.resolve(__dirname, '..', '..', 'salown')].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(path.join(c, 'functions', 'src', 'emails', 'index.ts'))) return c;
  return null;
}

function loadAdmin(appDir) {
  const tries = [];
  if (appDir) tries.push(path.join(appDir, 'functions', 'node_modules', 'firebase-admin'), path.join(appDir, 'node_modules', 'firebase-admin'));
  tries.push('firebase-admin');
  for (const t of tries) { try { return require(t); } catch (_) { /* next */ } }
  throw new Error('firebase-admin not found — run `npm ci` in <app-dir>/functions or pass --app-dir');
}

function loadCredential(admin, opts, appDir) {
  if (opts.key) return admin.credential.cert(JSON.parse(fs.readFileSync(opts.key, 'utf8')));
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return admin.credential.applicationDefault();
  if (appDir) {
    const conventional = path.resolve(appDir, '..', 'salown-panel', 'serviceAccountKey.json');
    if (fs.existsSync(conventional)) return admin.credential.cert(JSON.parse(fs.readFileSync(conventional, 'utf8')));
  }
  throw new Error('no credential: pass --key <serviceAccountKey.json> or set GOOGLE_APPLICATION_CREDENTIALS');
}

function loadForceList(appDir) {
  if (!appDir) return { list: FORCE_SALOWN_SENDER_FALLBACK, from: 'FALLBACK (no app-dir) — verify against functions/src/emails/index.ts' };
  const src = fs.readFileSync(path.join(appDir, 'functions', 'src', 'emails', 'index.ts'), 'utf8');
  const list = parseForceList(src);
  if (!list) return { list: FORCE_SALOWN_SENDER_FALLBACK, from: 'FALLBACK (constant not found in source)' };
  return { list, from: 'functions/src/emails/index.ts' };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.tenant) {
    console.log('usage: node scripts/confirmation-email-audit.cjs --tenant <tenantId> [--days 14] [--limit 200] [--app-dir <salown-app>] [--key <sa.json>] [--json]');
    process.exit(opts.help ? 0 : 2);
  }
  const appDir = resolveAppDir(opts.appDir);
  const admin = loadAdmin(appDir);
  if (!admin.apps.length) admin.initializeApp({ credential: loadCredential(admin, opts, appDir) });
  const db = readOnlyDb(admin.firestore());
  const tid = opts.tenant;
  const nowMs = Date.now();
  const sinceMs = nowMs - opts.days * 86400000;
  const since = admin.firestore.Timestamp.fromMillis(sinceMs);

  const [tenantSnap, settingsSnap, cfgSnap, force] = await Promise.all([
    db.doc(`tenants/${tid}`).get(),
    db.doc(`tenants/${tid}/settings/settings`).get(),
    db.doc(`tenants/${tid}/settings/emailConfig`).get(),
    Promise.resolve(loadForceList(appDir)),
  ]);
  if (!tenantSnap.exists) throw new Error(`tenant ${tid} does not exist`);
  const tenant = tenantSnap.data() || {};
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const gateOff = settings.emailConfirmationEnabled === false;
  const route = routeSender(tid, cfg, force.list);

  const bookingsSnap = await db.collection(`tenants/${tid}/bookings`).where('createdAt', '>=', since).orderBy('createdAt', 'desc').limit(opts.limit).get();
  const rows = bookingsSnap.docs.map(d => {
    const b = d.data() || {};
    const { verdict, detail } = classifyBooking(b, { gateOff, nowMs });
    return {
      docId: d.id, bookingId: b.bookingId || '—', verdict, detail,
      createdMs: toMs(b.createdAt), startMs: toMs(b.startTime), stampMs: toMs(b[STAMP_FIELD]),
      status: String(b.status || '').toUpperCase(), source: b.source || '—', bookingType: b.bookingType || '—',
      email: maskEmail(b.clientEmail), hasEmail: !!b.clientEmail, stripe: !!b.stripeSessionId,
    };
  });
  const summary = summarize(rows);

  // Brevo engagement webhook — the delivery side the stamp cannot see.
  let events = { total: 0, byLastEvent: {}, note: '' };
  try {
    const evSnap = await db.collection(`tenants/${tid}/emailEvents`).where('lastEventAt', '>=', since).orderBy('lastEventAt', 'desc').limit(200).get();
    for (const d of evSnap.docs) {
      const e = d.data() || {};
      events.total++;
      const k = String(e.lastEvent || '?');
      events.byLastEvent[k] = (events.byLastEvent[k] || 0) + 1;
    }
  } catch (err) { events.note = `emailEvents not readable (${err.message}) — an index may be needed; not required for the verdicts`; }

  const report = {
    tenant: tid, salonName: tenant.salonName || tenant.name || '—', windowDays: opts.days, bookingsRead: rows.length,
    gate: { emailConfirmationEnabled: settings.emailConfirmationEnabled === undefined ? 'absent (=on)' : settings.emailConfirmationEnabled },
    emailConfig: { hasEmail: !!cfg.email, hasAppPassword: !!cfg.appPassword },
    sender: { ...route, forceList: force.list, forceListFrom: force.from },
    summary: { ...summary, lastSentAt: iso(summary.lastSentMs), firstMissingAt: iso(summary.firstMissingMs) },
    brevoEvents: events,
    rows,
  };

  if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }

  const line = s => console.log(s);
  line(`\n═══ confirmation-email audit · ${tid} (${report.salonName}) · last ${opts.days} days · ${rows.length} bookings read (READ ONLY) ═══`);
  line(`tenant toggle  emailConfirmationEnabled = ${report.gate.emailConfirmationEnabled}${gateOff ? '   ⛔ OFF — this alone silences every confirmation for this tenant' : ''}`);
  line(`emailConfig    email:${cfg.email ? 'present' : 'absent'} appPassword:${cfg.appPassword ? 'present' : 'absent'} (values never printed)`);
  line(`sender route   ${route.via.toUpperCase()} — ${route.reason}   [FORCE list ${JSON.stringify(force.list)} from ${force.from}]`);
  line(`Brevo events   ${events.total} in window ${events.total ? JSON.stringify(events.byLastEvent) : ''}${events.note ? ' · ' + events.note : ''}`);
  line('');
  line('verdicts       ' + Object.entries(summary.counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));
  line(`last stamp     ${iso(summary.lastSentMs)}`);
  line(`first miss     ${iso(summary.firstMissingMs)}`);
  line(`READING        ${summary.reading}`);
  line('');
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  line(pad('created (UTC)', 18) + pad('start (UTC)', 18) + pad('status', 10) + pad('source/type', 18) + pad('email', 22) + pad('stripe', 7) + pad('verdict', 20) + 'docId · bookingId');
  for (const r of rows) {
    line(pad(iso(r.createdMs), 18) + pad(iso(r.startMs), 18) + pad(r.status, 10) + pad(`${r.source}/${r.bookingType}`, 18) + pad(r.email, 22) + pad(r.stripe ? 'yes' : '—', 7) + pad(r.verdict, 20) + `${r.docId} · ${r.bookingId}`);
  }
  line('');
  line('next, for every MISSING_CHECK_LOGS row (the docId is the grep key):');
  line('  firebase functions:log --project havuz-44f70 --only salownBookingConfirmationTrigger,salownBookingConfirmedEmailTrigger | grep -E "confirmationEmail|<docId>"');
  line('  an "[tenant] confirmationEmail error: Brevo 4xx …" line = the send failed (key/quota/sender/address); no line at all = the trigger never reached the send (early return, or trigger not firing).');
}

module.exports = { toMs, iso, maskEmail, isWalkInBooking, isEmailableBooking, routeSender, parseForceList, classifyBooking, summarize, parseArgs, readOnlyDb, STAMP_FIELD, STAMP_SINCE_MS };

if (require.main === module) {
  main().catch(err => { console.error('confirmation-email-audit: ' + (err && err.message ? err.message : err)); process.exit(1); });
}
