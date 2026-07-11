# SECURITY.md — Firestore Rules & Güvenlik (tek kaynak)

> **Amaç:** Firebase/Firestore güvenliğiyle ilgili HER ŞEY burada. Daha önce dağınıktı
> (ROADMAP.md, DEPLOY.md, firestore.rules yorumları, .LIVE/.DRAFT/.ROLLBACK artifact'ları).
> Aynı yerlere tekrar tekrar gelmemek için kategorize edildi. Güvenlik işi = bu dosya.
>
> **Canonical kural dosyası:** `salown-app/firestore.rules` (firebase.json buna bağlı).
> **Canlı ruleset:** G1+G4 (`0f8de7e`, 2026-06-27) — `tenantRole==null` fallback KALDIRILDI + catch-all
> write→false. Öncesi: G2+G3 (`851efeb`, ruleset `22bdc429`, 2026-06-24) → Phase 1 (`ef31d16a`, 06-21).
> **Bu doc'un kapsamı:** Firestore rules + custom claims + booking create/cancel/reschedule
> akış güvenliği. **⚠️ İŞ DURUMU burada değil — TEK KAYNAK [ROADMAP.md](ROADMAP.md) Pre-Scale Gate'tir;**
> bu doc teknik detay tutar. İlgili: [DEPLOY.md](DEPLOY.md) (deploy disiplini), memory `feedback-firestore-rules-safety`.

---

## 0. Hızlı durum tablosu

| # | Konu | Durum | Risk |
|---|------|-------|------|
| Phase 1 | Cross-tenant izolasyonu (global fallback `isAuth`→`isSuperAdmin`) | ✅ **DONE** (2026-06-21, ruleset `ef31d16a`) | — |
| Phase 1 | Tek canonical rules dosyası (`salown-app/firestore.rules`) | ✅ **DONE** | — |
| **G1** | Rol-claim backfill (`tenantRole == null → admin` fallback) | ✅ **CANLIDA** (2026-06-27, commit `0f8de7e`) — fallback kaldırıldı, claim'ler zaten tamdı, test 49/49 | 🔴→✅ |
| **G2** | `bookings read: if true` → tenant-scoped | ✅ **CANLIDA** (ruleset `22bdc429`, 2026-06-24) | 🟠 Orta |
| **G3** | Public create financial forge (`paidAmount/discount/tip`) | ✅ **CANLIDA** (ruleset `22bdc429`, 2026-06-24) | 🟢 Düşük |
| **G4** | staff-doc recursive catch-all (staff self-escalate) | ✅ **CANLIDA** (2026-06-27, commit `0f8de7e`) — catch-all write→false + 14 koleksiyon explicit, test 49/49. ⚠️ Takip: `AppRouter.jsx:104` `isAdmin=true` hardcoded → yeni staff web panele girmeden önce gerçek role'e bağla | 🟠→✅ |
| **G5** | Tek global ruleset blast radius | ⚠️ Kısmen (deploy disiplini var, yapısal çözüm yok) | 🟠 Orta |

> **2026-06-24 ilerlemesi:**
> - **G2 + G3 CANLIYA ALINDI** — `firestore.rules` main'e merge+push (`851efeb`), `firebase deploy
>   --only firestore:rules` → ruleset **`22bdc429-9501-4bd5-ae43-df4a694bd850`** (API'den doğrulandı,
>   [G2]/[G3] mevcut). Test API 25/25; whitecross/herohairs/panel akışları korunuyor kanıtlandı.
> - **G1 dry-run yapıldı.** Sadece 4 kullanıcının staff doc'u var (herohairs owner; whitecross
>   owner/admin/staff). ⚠️ tenantId claim'i olup staff doc'u olmayan ~6 kullanıcı (eekurt
>   `eekurt`↔`ee-kurt-barbers` uyuşmazlığı) → **fallback kaldırılırsa onlar admin'i kaybeder.**
>   `--apply` çalıştırılmadı (fallback aktifken işlevsiz, fallback kaldırma audit'siz riskli).
> - **G4 exhaustive enumere edildi** (~20 koleksiyon: settings/*, clients/*/campaignsSent,
>   finance_expenses/_payments, investment_transactions, auditLogs, campaigns, notifications,
>   team, fcmTokens, dashboardPrefs, ledger... + storage olabilecekler logo/cover/photo).
>   Catch-all write kaldırıp enumerate etmek tek koleksiyon atlanınca panel yazımını canlıda kırar
>   → kapsamlı test + review gerektiren AYRI iş; canlıya alınmadı.
> - functions/index.js'e dokunulmadı (busy-slot v2 turu kirletmiş). Test takibi: [TESTS.md](TESTS.md).

> ⚠️ ROADMAP "tenant #4'ten önce" diyor ama **3 tenant zaten canlı** (whitecross, eekurt,
> herohairs). Bu gate'ler bugün de aktif risk. En kritik: **G1**.

> **🔴 2026-06-27 BULGUSU — catch-all her şeyi eziyor (G1↔G4 bağı):** Rules Test API probe'ları
> (scratchpad/probe.py) kanıtladı ki tenant-içi `match /{document=**}` `write: if isTenantAny`
> kuralı, daha spesifik TÜM kuralları override ediyor (Firestore kuralları OR'lanır):
> - `tenantRole`'süz user **tenant-root'a `profileStatus` yazabiliyor → ALLOW** → `[P1-D]`
>   publication-control koruması fiilen ETKİSİZ (herhangi tenant üyesi publish/unpublish edebilir).
> - `tenantRole`'süz user **booking silebiliyor → ALLOW** → bookings `delete: if isAdmin` ezilmiş
>   (delete=admin-only fiilen yok; hedef delete=superadmin-only ile çelişiyor).
> - **staff kendi `staff/{uid}.permissions`'ını yazabiliyor → ALLOW** (G4 self-escalate, canlı).
>
> **Sonuç:** `isAdmin/isStaff/P1-D` rules düzeyinde fiilen ölü; gerçek kilit catch-all'ı daraltmak (**G4**).
> **G1 fallback-kaldırma TEK BAŞINA deploy edilmemeli** (güvenli ama faydasız tiyatro). G1+G4 birlikte.
> Audit (2026-06-27): 6 canlı tenant user'ının HEPSİ doğru `tenantRole` claim'ine sahip (backfill
> zaten uygulanmış); `tenantId` var ama `tenantRole` yok olan 3 user yalnız ölü/test tenant'larında
> (ee-kurt-barbers/the-hair-lab/the-test-lab) → fallback kaldırmak canlıyı etkilemez (25/25 yeşil).

---

## 1. Rules mimarisi (mevcut, kanıtlı)

### Helper katmanları (`firestore.rules:14-23`)
```
isAuth()        → request.auth != null
isSuperAdmin()  → token.superAdmin == true          (alish; silme + cross-tenant)
isTenant(tid)   → token.tenantId == tid             (kullanıcının kendi tenant'ı)
isAdmin(tid)    → isTenant && (tenantRole == null || in ['owner','admin'])   ← G1 buradan sızıyor
isStaff(tid)    → isTenant && (tenantRole == null || in ['owner','admin','staff'])
isTenantAny(tid)→ isTenant(tid)                      (rol bakmaz; sadece doğru tenant)
```

### Erişim katmanları (yukarıdan aşağıya)
1. **`/tenants/{tenantId}`** root doc — `read: if true` (public booking siteleri okuyor),
   write `isSuperAdmin() || isAdmin()`, publication-control alanları korumalı (`[P1-D]`).
2. **Tenant alt-koleksiyonları** — bookings/services/barbers/gallery/announcements (public read),
   staff (auth read), parserTombstones (tenant-only).
3. **Tenant catch-all** (`firestore.rules:105-108`, `[P1-B]`) — `{document=**}` derin path'ler
   için `isSuperAdmin() || isTenantAny()`. G4 zafiyeti bu katmanda.
4. **`/superAdmin/**`** — yalnız `isSuperAdmin()`.
5. **Global fallback** (`firestore.rules:122-124`, `[P1-A]`) — kapsanmayan her path yalnız
   `isSuperAdmin()`. **Phase 1'de buradaki `isAuth()` deliği kapatıldı.**

---

## 2. Phase 1 — yapıldı (2026-06-21)

**Sorun:** Global fallback `allow read, write: if isAuth()` idi → giriş yapan HERKES
(herhangi bir tenant kullanıcısı) BAŞKA tenant'ların verisine erişebiliyordu. Asıl
cross-tenant güvenlik açığı.

**Fix:** `[P1-A]` global fallback `isSuperAdmin()`'e indirildi; `[P1-B]` tenant catch-all
`{document=**}`'a genişletildi (same-tenant derin erişim kırılmasın diye); `[P1-C]` geçici
backwards-compat (tenantRole null→admin — bu G1'i doğurdu).

**Kanıt:** Rules Test API 16/16 (`docs/test-firestore-rules.py`); canlı ruleset
`ef31d16a` securityRules API ile doğrulandı (createTime 2026-06-21 13:38 GMT).
Rollback: `docs/firestore.rules.ROLLBACK.txt`. Snapshot: `docs/firestore.rules.LIVE`.

---

## 3. Açık gate'ler — kod karşı doğrulama + fix planı

> Aşağıdaki blast-radius analizleri **gerçek koda karşı** yapıldı (2026-06-24). Her birinde
> "ROADMAP iddiası doğru mu?" sorusu yanıtlandı.

### 🔴 G1 — Rol-claim backfill (EN KRİTİK)

**İddia:** `tenantRole == null → admin` yüzünden tüm permission sistemi ölü; tenant'ı olan
herkes admin sayılıyor. **→ DOĞRU.** `firestore.rules:21-22` `== null` fallback'i var;
2026-06-21 denetimi mevcut ~10 user'ın HİÇBİRİNDE `tenantRole` claim'i olmadığını saptamış.
`setCustomUserClaims(... tenantRole ...)` çağrısı kod tabanında **HİÇ YOK** (grep: sıfır).

**Sonuç:** owner/admin/staff ayrımı rules düzeyinde fiilen yok. Permission UI (Settings'teki
7 izin) sadece app-içi; rules tarafında bir staff, admin gibi yazabiliyor.

**✅ Backfill script YAZILDI: `salown-app/scripts/backfillTenantRoles.cjs`** (henüz çalıştırılmadı).
Dry-run default; `tenants/*/staff/{uid}.role`'u okuyup `setCustomUserClaims(uid, {...mevcut,
tenantId, tenantRole})` ile MERGE eder (tenantId/superAdmin korunur). Konvansiyon:
`migrateWhitecrossServices.cjs` ile aynı (service account `../../salown-panel/serviceAccountKey.json`).

**Fix sırası (yanlış sıra herkesi kilitler):**
1. `node scripts/backfillTenantRoles.cjs` → **dry-run**, çıktıyı incele (10 user, role eşleşmeleri).
2. `node scripts/backfillTenantRoles.cjs --apply` → claim'leri yaz.
3. Kullanıcıların token'ı yenilenmeli (re-login veya `getIdToken(true)`).
4. **ANCAK ondan sonra** `firestore.rules:21-22`'den `tenantRole == null ||` fallback'ini kaldır.
5. Test API ile doğrula → deploy (rules EN SON).
> ⚠️ Adım 4'ü backfill'den ÖNCE yaparsan claim'siz tüm admin'ler kilitlenir (Settings yazamaz).

**🔴 AUDIT BULGUSU (2026-06-24) — fallback kaldırma GÜVENLİ DEĞİL:** Aktif tenant = **yalnız whitecross +
herohairs** (eekurt/the-hair-lab/test canlı değil → önemsiz). Auth audit (`auth.listUsers` + staff doc kontrolü):
- ✓ staff doc VAR: aerulas@ (whitecross owner+superAdmin), auzun9499@ (whitecross admin),
  muhammedkanidagli74@ (whitecross staff), durvezek@ (herohairs owner) → backfill bunlara doğru tenantRole basar.
- ❌ **staff doc YOK ama tenantId claim'i VAR (2 CANLI user):** `whitecrossbarbers@gmail.com` (whitecross,
  superAdmin:false — **owner'ın kendi hesabı**) ve `alex2ayyildiz3@gmail.com` (herohairs). Bunlara backfill
  `tenantRole` basamaz (staff doc yok) → **fallback kaldırılırsa bu ikisi whitecross/herohairs admin'i kaybeder.**

**Adım 4 (fallback kaldırma) öncesi ZORUNLU:** bu 2 user'a karar ver — (a) staff doc oluştur (uygun role:
whitecrossbarbers@=owner?/admin?, alex2ayyildiz3@=?), VEYA (b) tenantRole claim'ini elle ata. Sonra backfill'i
tekrar koş → token propagasyonu (re-login/getIdToken(true) veya ~1sa) → ANCAK ondan sonra fallback kaldır + deploy.

**Risk:** Backfill'den ÖNCE fallback kaldırılırsa, claim'i olmayan tüm admin'ler kilitlenir
(Settings'ten tenant-doc yazamaz → Stripe/features kırılır). Bu yüzden script önce.

---

### 🟠 G2 — `bookings read: if true` (whitecross client-side bağımlılığı var — KARAR GEREKİYOR)

**İddia:** Herkes (auth olmasa bile) tüm müşteri booking'lerini okuyabiliyor (GDPR); whitecross
dup-check buna dayanıyor. **→ Açık DOĞRU. İlk değerlendirme "düşük risk" idi; whitecross-site
kodunu okuyunca DÜZELTİLDİ → orta risk, karar gerektiriyor.**

**Kod karşı analiz (2026-06-24):**
- `firestore.rules:39` → `allow read: if true` aynen açık.
- **salown-app (herohairs dahil) public hiçbir yer bookings okumuyor.** `BookingPage.jsx:313-317`
  yalnız services/serviceCategories/barbers okuyor; busy slot'ları `salownGetBusySlots`
  **callable**'dan alıyor (`functions/index.js:1088`, Admin SDK → rules bypass). → herohairs G2'den
  ETKİLENMEZ.
- Panel/staff bookings'i `firestoreActions.js`'te `${TENANT}/bookings` ile **authenticated**
  okuyor → tenant-scoped kurala düşer, kırılmaz.
- ⚠️ **whitecross-site (ayrı kod tabanı) 3 yerde unauthenticated bookings OKUyor:**
  1. `script.js:471` dup-check — `try/catch` **fails-open** → booking devam eder. ✅ Güvenli.
  2. `script.js:1809` grup-confirm read (Stripe dönüşü sonrası client-side CONFIRMED yazmak için)
     — kod yorumu "webhook also does this server-side" → DENY olunca webhook telafi eder. Degrade.
  3. `script.js:1846` Stripe-back cancel read (PENDING'i iptal) — DENY olunca client iptal edemez;
     `salownCleanupExpiredPending` 15dk sonra temizler. Degrade (anlık değil).

**Sonuç:** G2 booking OLUŞTURMAYI bozmaz (her iki tenant da), ama whitecross'un iki post-Stripe
client-side kolaylığını (grup-confirm + Stripe-back anlık iptal) server fallback'e indirir.
"Akışı bozma" kırmızı çizgisi gereği bu KARAR kullanıcıya ait — sessizce uygulanmadı.

**Seçenekler:**
- **(a) Şimdi uygula, degrade'i kabul et:** webhook + 15dk cleanup zaten telafi ediyor; GDPR deliği
  hemen kapanır. Risk: whitecross konsolunda permission-denied logları, nadir webhook gecikmesinde
  grup booking confirm gecikmesi.
- **(b) Ertele:** önce whitecross-site'ın 3 read'ini kaldır/callable'a taşı, sonra G2 deploy.
  Ama bu whitecross-site'a dokunmak demek (busy-slot turu functions'ı kirletmiş; ayrı tur).

**Fix (uygulanınca):** `firestore.rules:39` → `allow read: if isSuperAdmin() || isTenantAny(tenantId);`

---

### 🟢 G3 — Public create financial forge

**İddia:** Public create'te `paidAmount`/`discount`/`tip` doğrulaması yok → forge edilebilir.
**→ DOĞRU.** `firestore.rules:40-42` create yalnız `status in ['PENDING','CONFIRMED']`
kontrol ediyor; finansal alan kontrolü yok. (Update path'te whitelist var, korunuyor.)

**Kod karşı analiz:** Meşru public create payload'ı (`BookingPage.jsx:541-563`) **paidAmount/
discount/tip/platformDepositAmount YAZMIYOR** — yalnız `price` (servis fiyatı, display) yazıyor.

**Sonuç:** Create kuralına "bu finansal alanlar create'te BULUNMAMALI" kısıtı eklemek meşru
akışı bozmaz (zaten göndermiyor), ama saldırganın `paidAmount: 999` forge etmesini engeller.

**⚠️ whitecross-site doğrulaması (2026-06-24):** `writeBookingStatus` (script.js:1136) ve grup
create (script.js:1360) `paymentState`/`paymentType`/`depositPerPerson` YAZIYOR ama `paidAmount`/
`discount`/`tip` yazMIYOR (grep: sıfır). salown-app `BookingPage` de yazmıyor. → Blocklist
**yalnız `paidAmount`/`discount`/`tip`** olmalı; `paymentState`'i blocklarsak whitecross create kırılır.

**✅ UYGULANDI (`firestore.rules:38-46`, deploy bekliyor):**
```
allow create: if isSuperAdmin() || isTenantAny(tenantId) || (
  request.resource.data.status in ['PENDING','CONFIRMED'] &&
  !request.resource.data.keys().hasAny(['paidAmount', 'discount', 'tip'])
);
```
(`price`/`paymentState` forge'u ayrı/düşük konu — display + state; gerçek para callable/webhook
tarafında yazılır. İstenirse Faz 2 `salownCreateBooking` transactional'da sunucu-taraf doğrulama.)

---

### 🟠 G4 — staff-doc recursive catch-all (staff self-escalate)

**İddia:** Spesifik staff kuralı (`firestore.rules:89`) admin-only ama catch-all `{document=**}`
(`:105-108`) aynı path'i `isTenantAny`'e açıyor; kurallar OR'lanır → staff kendi
`permissions`'ını yazabilir. **→ DOĞRU** (Firestore'da match kuralları OR'lanır; en geniş izin kazanır).

**Tehlike:** `canViewRevenue:false` bir staff, kendi staff doc'undaki `permissions`'ı doğrudan
yazıp `canViewRevenue:true` yapabilir → app-içi permission sistemi (G1 ile birlikte) tamamen delik.

**Neden basit yama YETMEZ:** Firestore match kuralları OR'lanır; daha spesifik `match /staff/{uid}`
kuralı admin-only olsa bile catch-all `{document=**}` write'ı `isTenantAny` verdiği için staff yazısı
geçer. "Daha sıkı spesifik kural ekle" işe yaramaz (union, intersection değil). Tek çözüm: **catch-all
write'ını kaldır + auth kullanıcıların yazdığı koleksiyonları enumerate et.**

**Enumerasyon (2026-06-24, `grep tenants/{id}/<col>` src):**
- Zaten explicit eşleşen: `bookings, services, serviceCategories, barbers, gallery, announcements,
  staff, parserTombstones, public`.
- **Yalnız catch-all'a bağlı (yeni explicit kural gerekir):** `advances, auditLogs, campaigns,
  clients (+ derin: clients/{id}/campaignsSent), cover, expenses, finance, investment, logo,
  notifications, products, team, settings, fcmTokens`.

**Önerilen fix (DRAFT — Rules Test API'siz deploy ETME):**
```
// staff hariç her tenant alt-koleksiyonu auth tenant üyesine açık (recursive — derin path'ler için)
match /clients/{document=**}  { allow read, write: if isSuperAdmin() || isTenantAny(tenantId); }
match /campaigns/{document=**} { allow read, write: if isSuperAdmin() || isTenantAny(tenantId); }
match /settings/{document=**}  { allow read, write: if isSuperAdmin() || isTenantAny(tenantId); }
... (advances, auditLogs, cover, expenses, finance, investment, logo, notifications, products, team, fcmTokens)
// catch-all: READ açık kalır, WRITE kalkar → staff/{uid} yalnız üstteki admin-only kuralından yazılır
match /{document=**} {
  allow read:  if isSuperAdmin() || isTenantAny(tenantId);
  allow write: if false;   // tüm yazılabilir koleksiyonlar yukarıda explicit
}
```
- ⚠️ **Doğrulama ŞART:** değişiklik öncesi/sonrası `docs/test-firestore-rules.py` ile panel + staff
  app'in TÜM yazma yolları (booking, walk-in, checkout, client merge, campaign, settings, finance,
  audit) yeşil kalmalı. Eksik bırakılan tek koleksiyon = o panel özelliği kırılır (whitecross/herohairs).
- **Bu yüzden G4 henüz `firestore.rules`'a UYGULANMADI** — enumerasyon listesi tam mı, test ile kanıtlanmalı.

---

### 🟠 G5 — Tek global ruleset blast radius

**Durum:** Tüm tenant'lar tek ruleset paylaşıyor → bir hata her tenant'ı vurur. Yapısal çözüm
(per-tenant ruleset) Firestore'da pratik değil. Mevcut azaltıcılar:
- TEK KAYNAK kuralı (`DEPLOY.md:24`): rules yalnız `salown-app/firestore.rules`'tan deploy.
- Test-before-deploy: `python3 docs/test-firestore-rules.py salown-app/firestore.rules`.
- Rollback hazır: `docs/firestore.rules.ROLLBACK.txt`.
- Canlı doğrulama: securityRules API'den ruleset çek, en son deploy kazanır.

**Kalan:** Bu disiplini bir CI check'e bağlamak (deploy öncesi otomatik test). Düşük öncelik.

---

## 4. Booking akış güvenliği (create / cancel / reschedule) — BOZMA HARİTASI

> Gate fix'leri bu akışları BOZMAMALI. Her akışın rules'a bağımlılığı:

| Akış | Mekanizma | Rules'a bağımlı mı? | Gate etkisi |
|------|-----------|---------------------|-------------|
| **Public booking create** | `BookingPage.jsx:541` `addDoc` (client) | ✅ Evet — `bookings create` | G3 burayı sıkar (güvenli; payload finansal alan yazmıyor) |
| **Busy slot sorgu** | `salownGetBusySlots` callable (Admin SDK) | ❌ Hayır (bypass) | G2'den etkilenmez |
| **Cancel (müşteri)** | `salownCancelByToken` callable (Admin SDK) | ❌ Hayır (bypass) | hiçbir gate'ten etkilenmez |
| **Reschedule (müşteri)** | `salownRescheduleByToken` callable (Admin SDK) | ❌ Hayır (bypass) | hiçbir gate'ten etkilenmez |
| **Panel/staff okuma** | `${TENANT}/bookings` authenticated | ✅ Evet — `bookings read` | G2 sonrası `isTenantAny` ile çalışır |
| **Panel/staff yazma** | walk-in/checkout addDoc/update | ✅ Evet — catch-all/bookings | G4 daraltmasında test edilmeli |

**Altın kural:** Cancel/reschedule **server-side callable** olduğu için rules sıkılaştırması
onları HİÇ etkilemez. Asıl dikkat: (a) public create (G3) ve (b) panel yazma yolları (G4).

### ⚠️ whitecross-site = ayrı kod tabanı, AYNI Firestore'a doğrudan yazıyor (rules'ı bağlar)

> whitecrossbarbers.com (`whitecross-site/script.js`) salown-app DEĞİL — ama `tenants/whitecross/bookings`'e
> doğrudan, çoğu **unauthenticated** erişiyor. Her rules değişikliği bunları da etkiler. Harita:

| Satır | İşlem | Alanlar | Rules dalı | Gate etkisi |
|-------|-------|---------|-----------|-------------|
| `script.js:471` | **read** dup-check (clientPhone) | — | `bookings read` | G2 → DENY ama `try/catch` fails-open, booking devam |
| `script.js:1136/1360` | **create** (writeBookingStatus/grup) | paymentState, paymentType, depositPerPerson (paidAmount/discount/tip YOK) | `bookings create` | G3 → güvenli (bu alanları yazmıyor) |
| `script.js:1809` | **read** grup-confirm | — | `bookings read` | G2 → DENY; webhook server-side telafi |
| `script.js:1813` | **update** grup-confirm | status, paymentState, paidAt | `bookings update` whitelist | paymentState/paidAt whitelist'te YOK → bugün de DENY, sessiz fail, webhook yapar (regresyon yok) |
| `script.js:1846` | **read** Stripe-back cancel | — | `bookings read` | G2 → DENY; 15dk cleanup telafi |
| `script.js:1850` | **update** Stripe-back cancel | status, cancelledAt | `bookings update` whitelist | whitelist'te VAR → bugün çalışıyor; G2 read'i kesince tetiklenemez |

**Çıkarım:** whitecross booking CREATE hiçbir gate'ten kırılmaz. G2 yalnız 2 client-side
post-Stripe kolaylığını server fallback'e indirir (bkz §3 G2 kararı). whitecross-site'a
dokunmadan tüm gate'ler rules + script ile kapatılabilir.

---

## 5. Önerilen uygulama sırası (düşük riskten yükseğe)

1. **G3** (financial forge) — saf rules, meşru akış zaten finansal alan yazmıyor. En güvenli.
2. **G2** (bookings read) — saf rules, salown-app etkilenmez, whitecross fails-open.
3. **G4** (staff catch-all) — rules, ama panel/staff yazma testleri şart.
4. **G1** (rol-claim backfill) — script + token yenileme + rules; en kritik, en dikkatli.
5. **G5** — deploy disiplinini CI'a bağla (opsiyonel).

**Her adım:** değiştir → `docs/test-firestore-rules.py` ile test → onay → deploy
(sıra: functions varsa önce, **rules EN SON**). Aynı turda birden fazla gate'i deploy etme;
tek tek doğrula (G5 blast radius mantığı).

> ⚠️ **functions/index.js şu an kirli** (busy-slot v2 / processing-time çalışması, başka session).
> G2'nin opsiyonel "PII'sız dup-check callable"ı functions'a dokunur → o işe GİRME, busy-slot
> turuyla çakışır. Gate'lerin tamamı **yalnız `firestore.rules` + yeni script dosyası** ile
> kapatılabilir (functions'a dokunmadan). Bkz §3.

---

## 6. Artifact & araç envanteri

| Dosya | Tür | Amaç |
|-------|-----|------|
| `salown-app/firestore.rules` | canlı kod | TEK canonical kaynak (firebase.json) |
| `docs/firestore.rules.LIVE` | snapshot | Deploy edilenin kopyası (drift kontrolü) |
| `docs/firestore.rules.ROLLBACK.txt` | rollback | Acil geri dönüş |
| `docs/firestore.rules.DRAFT` | taslak | Phase 1 draft (eski; `[P1-D]` yok) — referans |
| `docs/test-firestore-rules.py` | test | Rules Test API (Java/emulator gerekmez) |

---

## 7. Roller & yetki modeli (hedef + mevcut) — 2026-06-24

> **Owner kararı (2026-06-24):** Yetkilendirme şu an "herkes admin" (null→admin fallback) modunda
> çalışıyor; gerçek rol sistemi devrede değil. Hedef **dinamik** rol mimarisi: ileride
> `superadmin / admin / manager / staff` atamaları **tasarımla** yapılacak → yapı buna hazır olmalı
> (rol+izinler veri-odaklı, hardcode değil).

### Hedef yetki matrisi (interim — dinamik tasarıma kadar)
| Rol | Kapsam |
|-----|--------|
| **superadmin** | HER ŞEY, cross-tenant. Tenant root/staff/settings/auditLogs/finance silme YALNIZ superadmin. |
| **owner** | Kendi tenant'ında her şey + **kendi VERİSİNİ silme** (E1b, 2026-07-11): bookings/services/serviceCategories/gallery/announcements/discountCodes/clients/campaigns/products/**barbers** (barbers UI'da güçlü onay modallı). Cross-tenant HİÇBİR ŞEY. |
| **admin** | Her şeyi görür + değiştirir (create/update), **silemez**. |
| **manager** | (ileride tasarlanacak — admin/staff arası) |
| **staff** | Sınırlı; `permissions` objesiyle izinler (canCreateBookings/canCheckOut/... toggles) |

> ✅ **E1b CANLI (2026-07-11, ruleset test 83/83):** delete = `isSuperAdmin() || isOwner(tenantId)`
> (yukarıdaki owner satırındaki koleksiyonlarda). `isOwner(tid)` = tenantId eşleşir + tenantRole=='owner'.
> Admin/staff/cross-tenant delete DENY — testli. Super-only kalanlar: tenant root, staff, settings,
> auditLogs, finance ailesi, Clients merge-drag. "Silme YALNIZ superadmin" dönemi (2026-07-02→07-11)
> pilot politikasıydı; E1b onu tenant-scoped owner'a genişletti (durum kaydı: ROADMAP E1b).
> Bkz memory `feedback-delete-superadmin-only`.

### Mevcut kullanıcılar (2026-06-24, canlı = whitecross + herohairs)
| Email | Tenant | Rol (staff doc) | superAdmin claim | Not |
|-------|--------|-----------------|------------------|-----|
| aerulas@gmail.com | whitecross | owner | **YES** | **Owner'ın superadmin hesabı — silme yetkisi yalnız burada** |
| auzun9499@gmail.com (Arda) | whitecross | admin | false | Her şey hariç silme |
| muhammedkanidagli74@gmail.com | whitecross | staff | false | İzinler permissions objesinde |
| whitecrossbarbers@gmail.com | whitecross | **staff** ✅ | false | 2026-06-24 staff doc oluşturuldu (önce rolü yoktu, fallback'le admin görünüyordu) |
| durvezek@gmail.com | herohairs | owner | false | herohairs sahibi |
| alex2ayyildiz3@gmail.com | herohairs | **owner** ✅ | false | 2026-06-24 owner doc oluşturuldu |

> ✅ **Tüm canlı kullanıcıların rolü TAM** (2026-06-24) → G1 backfill artık engelsiz.

### Açık TODO (sonraki oturum)
- [ ] **G1 tamamla:** `node scripts/backfillTenantRoles.cjs --apply` → token propagasyonu (re-login/~1sa)
      → `firestore.rules:21-22` `tenantRole==null ||` fallback kaldır → Test API → deploy. ⚠️ Aktif
      kullanıcı varken fallback kaldırma anlık admin-düşüşü yapar; token yenilenmesini bekle.
- [ ] **Dinamik rol sistemi** (superadmin/admin/manager/staff, veri-odaklı izinler) — tasarım + impl.
- [ ] **delete = superadmin-only** rules refactor (kapsamlı; dinamik rolle birlikte).
- [ ] **Signup koruması:** `salownSelfSignup` public → bot kaydı mümkün (2026-06-24 spam hesabı silindi).
      Email confirmation / doğrulama kodu / CAPTCHA ekle.

## İlgili dokümanlar
- [DEPLOY.md](DEPLOY.md) — rules deploy disiplini, TEK KAYNAK kuralı, deploy sırası
- [ROADMAP.md](ROADMAP.md) — #9 (Rules Phase 2) + PRE-SCALE HARDENING GATE (G1–G5)
- [BUSINESS_RULES.md](BUSINESS_RULES.md) — booking create/cancel/reschedule iş kuralları
- [INCIDENTS.md](INCIDENTS.md) — geçmiş güvenlik/rules kazaları
- memory `feedback-firestore-rules-safety`, `feedback-tenant-root-doc-public`,
  `feedback-delete-superadmin-only`, `project-salown-prescale-hardening`
</content>
</invoke>
