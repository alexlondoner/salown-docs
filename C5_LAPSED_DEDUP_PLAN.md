# C5 — Lapsed Re-engage Dedup: Tam Fix Planı

> Durum: **PLAN (kod yazılmadı).** Teşhis + karar kaydı: memory `lapsed-dedup-limitation`, ROADMAP C5 item-3, edit_log 2026-07-02.
> Bu belge paste-hazır; gözetimli (onaylı) uygulanmalı — backend client doc yazar.

## Problem (özet)
Re-engage dedup yalnızca **kayıtlı client doc'u (manualId) olan** kişilerde çalışıyor. Walk-in/aggregator müşterisi client doc'una sahip değil → send'de `clientId=null` (`SendCampaignPanel.jsx:127`) → backend `if(clientId)` bloğu (`functions/index.js:3562`) stamp'i **atlıyor** → Home lapsed listesinde tekrar tekrar çıkıyor. Birthday bağışık (birthday sadece client doc'unda).

## Önerilen çözüm: **A — backend find-or-create** (en temiz, mevcut mantığı yeniden kullanır)
`resolveMemberDocId` (`Clients.jsx:255-263`) zaten **find-or-create** yapıyor: phone→email→name ile mevcut doc'u arar, yoksa yaratır. Bunu **server-side** aynala: `sendMarketingEmail` `clientId` null olduğunda client doc'u bul-ya-da-yarat, sonra stamp'le. Böylece:
- Stamp her zaman bir doc'a düşer (walk-in dahil).
- Doc oluşunca kişi bir sonraki Home yüklemesinde `clients` dizisine girer (Clients.jsx merge/dedup) → **mevcut suppress mantığı ekstra kod olmadan yakalar**.
- Yan etki (kullanıcının da istediği): re-engage ettikçe müşteri DB'si kurulur.

Neden A > B: B (ayrı `reengagements` koleksiyonu) Home'a yeni eşleştirme kodu gerektirir ve mevcut identity dedup'ını kullanmaz. A, `resolveMemberDocId`'nin kanıtlı find-first mantığını yeniden kullanır → daha az yeni kod, daha doğru eşleşme.

## Uygulama

### 1. Backend — `functions/index.js`, `sendMarketingEmail` (opt-out geçtikten SONRA, stamp bloğunda)
`if (clientId)` bloğunu, clientId yoksa bul-ya-da-yarat edecek şekilde genişlet. Yeni helper:

```js
// find-or-create — resolveMemberDocId'nin (Clients.jsx) server-side aynası.
// Sadece re-engage gibi "kalıcı ilişki" gönderimlerinde çağır; opt-out ZATEN kontrol edildi.
async function _resolveClientDocId(db, tenantId, { clientName, clientEmail, clientPhone }) {
    const norm = p => String(p || '').replace(/[\s\-().+]/g, '').toLowerCase();
    const email = String(clientEmail || '').toLowerCase();
    const name  = String(clientName  || '').toLowerCase();
    if (!email && !name) return null;                  // eşleşecek/yaratacak kimlik yok
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

Stamp bloğunu güncelle (mevcut `if (clientId) { ... }` yerine):

```js
// re-engage: doc yoksa bul-ya-da-yarat, sonra stamp (walk-in/aggregator dahil kapsansın)
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

### 2. Frontend (opsiyonel, eşleşmeyi güçlendirir) — `SendCampaignPanel.jsx` doSend payload
`clientPhone: client?.phone || null` ekle (backend phone ile daha iyi eşleştirir). Tek satır, düşük risk.

### 3. Home — DEĞİŞİKLİK YOK
Doc oluşunca kişi `clients` dizisine girer → mevcut `recentlyReengaged` suppress'i yakalar. (İsim-only eşleşme kısıtı sürer ama artık walk-in de kapsanır → bugünden kesinlikle daha iyi.)

## Guard / edge case
- Opt-out **önce** kontrol edilir (mevcut kod) → opt-out'a doc yaratma yok.
- `email` ve `name` ikisi de boşsa doc yaratma (`_resolveClientDocId` null döner) → çöp doc yok.
- find-first phone→email→name → aynı kişiye ikinci doc açma riski düşük (aynı-isim farklı-kişi residual risk sürer, mevcut davranışla aynı seviyede).
- Sadece re-engage'te create; custom/loyalty/birthday'de clientId yoksa create YOK (kapsamı dar tut).

## Test planı
1. **Kayıtlı client** (manualId var) → re-engage → `reengagementSentAt` yazılır, Home'dan düşer (regresyon yok).
2. **Walk-in (doc yok), email VAR** → re-engage → yeni client doc yaratılır + stamp; Home yenilenince düşer.
3. **Walk-in, email YOK ad VAR** → aynı ada sahip mevcut doc'a bağlanır ya da yeni yaratılır; çöp doc yok.
4. **Aynı kişiye 2. re-engage** → find-first mevcut doc'u bulur, **duplicate yaratmaz**.
5. **Opt-out'lu kişi** → doc yaratılmaz, gönderim yok.

## Rollout (gözetimli)
1. Backend `sendMarketingEmail` düzenle → `node --check`.
2. (Ops.) `SendCampaignPanel.jsx` clientPhone payload.
3. Deploy: `firebase deploy --only functions:salown:sendMarketingEmail` (+ frontend push varsa CI hosting).
4. Canlı smoke: whitecross'ta bir walk-in lapsed kişiye test re-engage → client doc oluştu + `reengagementSentAt` set + Home'dan düştü mü.
5. Edit log + ROADMAP C5 item-3 → ✅.

## Risk
🟡 Orta-düşük. Yazım kapsamı: yeni client doc'ları (find-first ile dedup'lı). Geri alınabilir (yanlış doc silinebilir). Müşteriye otomatik gönderim YOK (send yine owner-tetikli). Auth/rules'a dokunmaz.
