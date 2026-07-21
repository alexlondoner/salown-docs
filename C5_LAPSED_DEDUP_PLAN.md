# C5 — Lapsed Re-engage Dedup: Full Fix Plan

> Status: **PLAN (no code written).** Diagnosis + decision record: memory `lapsed-dedup-limitation`, ROADMAP C5 item-3, edit_log 2026-07-02.
> This document is paste-ready; it must be applied under supervision (approved) — the backend writes a client doc.

## Problem (summary)
Re-engage dedup only works for people who **have a saved client doc (manualId)**. A walk-in/aggregator customer does not have a client doc → on send `clientId=null` (`SendCampaignPanel.jsx:127`) → the backend `if(clientId)` block (`functions/index.js:3562`) **skips** the stamp → they keep showing up again and again in the Home lapsed list. Birthday is immune (birthday only lives on the client doc).

## Proposed solution: **A — backend find-or-create** (cleanest, reuses existing logic)
`resolveMemberDocId` (`Clients.jsx:255-263`) already does **find-or-create**: it looks up an existing doc by phone→email→name, and creates one if none exists. Mirror this **server-side**: when `sendMarketingEmail` `clientId` is null, find-or-create the client doc, then stamp it. This way:
- The stamp always lands on a doc (walk-in included).
- Once the doc exists, the person enters the `clients` array on the next Home load (Clients.jsx merge/dedup) → **the existing suppress logic catches it with no extra code**.
- Side effect (which the user also wants): the more you re-engage, the more the customer DB gets built up.

Why A > B: B (a separate `reengagements` collection) requires new matching code on Home and does not use the existing identity dedup. A reuses `resolveMemberDocId`'s proven find-first logic → less new code, more accurate matching.

## Implementation

### 1. Backend — `functions/index.js`, `sendMarketingEmail` (AFTER opt-out passes, in the stamp block)
Extend the `if (clientId)` block so that when clientId is missing it does find-or-create. New helper:

```js
// find-or-create — server-side mirror of resolveMemberDocId (Clients.jsx).
// Only call for "durable relationship" sends like re-engage; opt-out is ALREADY checked.
async function _resolveClientDocId(db, tenantId, { clientName, clientEmail, clientPhone }) {
    const norm = p => String(p || '').replace(/[\s\-().+]/g, '').toLowerCase();
    const email = String(clientEmail || '').toLowerCase();
    const name  = String(clientName  || '').toLowerCase();
    if (!email && !name) return null;                  // no identity to match/create
    const col = db.collection(`tenants/${tenantId}/clients`);
    const snap = await col.get();
    let found = null;
    snap.forEach(d => {
        if (found) return;
        const dd = d.data();
        if (clientPhone && norm(dd.phone) === norm(clientPhone)) found = d.id;
        else if (email && String(dd.email || '').toLowerCase() === email) found = d.id;
        else if (name && String(dd.name || '').toLowerCase() === name) found = d.id;
    });
    if (found) return found;
    const ref = await col.add({ name: clientName || '', phone: clientPhone || '', email: clientEmail || '', createdAt: new Date() });
    return ref.id;
}
```

Update the stamp block (replacing the existing `if (clientId) { ... }`):

```js
// re-engage: if no doc, find-or-create, then stamp (so walk-in/aggregator are covered too)
let stampId = clientId;
const isReengage = campaignType === 're-engagement' || campaignType === 're-engage';
if (!stampId && isReengage) {
    try { stampId = await _resolveClientDocId(db, tenantId, { clientName, clientEmail, clientPhone: request.data?.clientPhone }); }
    catch (e) { console.warn('[sendMarketingEmail] resolve client doc failed:', e.message); }
}
if (stampId) {
    try {
        await db.collection(`tenants/${tenantId}/clients/${stampId}/campaignsSent`).add({ type: campaignType || 'custom', templateId: templateId || null, subject: subject || '', sentAt: new Date(), sentByUid: request.auth?.uid || null });
        if (campaignType === 'birthday') await db.doc(`tenants/${tenantId}/clients/${stampId}`).set({ birthdayCampaignYear: new Date().getFullYear() }, { merge: true });
        if (isReengage)                  await db.doc(`tenants/${tenantId}/clients/${stampId}`).set({ reengagementSentAt: new Date() }, { merge: true });
    } catch (e) { console.warn('[sendMarketingEmail] campaignsSent log failed:', e.message); }
}
```

### 2. Frontend (optional, strengthens matching) — `SendCampaignPanel.jsx` doSend payload
Add `clientPhone: client?.phone || null` (the backend matches better with phone). One line, low risk.

### 3. Home — NO CHANGE
Once the doc exists, the person enters the `clients` array → the existing `recentlyReengaged` suppress catches it. (The name-only matching limitation remains, but now walk-ins are covered too → definitely better than today.)

## Guard / edge case
- Opt-out is checked **first** (existing code) → no doc creation for an opt-out.
- If both `email` and `name` are empty, no doc is created (`_resolveClientDocId` returns null) → no junk doc.
- find-first phone→email→name → low risk of opening a second doc for the same person (the same-name different-person residual risk remains, at the same level as current behavior).
- Create only on re-engage; for custom/loyalty/birthday there is NO create when clientId is missing (keep the scope narrow).

## Test plan
1. **Registered client** (has manualId) → re-engage → `reengagementSentAt` is written, drops off Home (no regression).
2. **Walk-in (no doc), HAS email** → re-engage → a new client doc is created + stamp; drops off when Home refreshes.
3. **Walk-in, NO email but HAS name** → linked to an existing doc with the same name or a new one created; no junk doc.
4. **2nd re-engage to the same person** → find-first finds the existing doc, **does not create a duplicate**.
5. **Opted-out person** → no doc created, no send.

## Rollout (supervised)
1. Edit backend `sendMarketingEmail` → `node --check`.
2. (Opt.) `SendCampaignPanel.jsx` clientPhone payload.
3. Deploy: `firebase deploy --only functions:salown:sendMarketingEmail` (+ CI hosting if there is a frontend push).
4. Live smoke: test re-engage a walk-in lapsed person on whitecross → did the client doc get created + `reengagementSentAt` set + drop off Home.
5. Edit log + ROADMAP C5 item-3 → ✅.

## Risk
🟡 Medium-low. Write scope: new client docs (deduped via find-first). Reversible (a wrong doc can be deleted). NO automatic send to the customer (send is still owner-triggered). Does not touch auth/rules.
