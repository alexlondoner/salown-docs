# AUDIT_TRAIL_PLAN — Tam kapsamlı audit trail (ROADMAP I4)

> Kaynak: owner istek 2026-07-12 (Muhamed leave-wipe vakası — INCIDENTS 2026-07-12:
> "kim yaptı" sorusuna cevap yoktu çünkü barber değişiklikleri loglanmıyor).
> Owner ilkesi: **"sistemde yapılan her işlem için olması gerekmez mi?"** → evet,
> her YAZMA işlemi; okuma loglanmaz (gürültü + maliyet + değeri yok).
> **Gate: TS migration freeze — kod 2026-07-14'ten önce yazılmaz.** Durum SSOT: ROADMAP I4.

## 1. Bugünkü durum (2026-07-12 envanteri, grep'le doğrulandı)

**Altyapı var ve iyi:** `src/utils/auditLogger.ts` `logAudit(action, details)` —
actor'ı (uid/email/name) otomatik ekliyor, `tenants/{id}/auditLogs`'a yazıyor,
fail-silent. Viewer: `src/pages/AuditLog.tsx`. Functions tarafı ham `.add()`.

**Kapsanan (~25 tip):**
| Alan | Tipler | Kaynak |
|---|---|---|
| Booking ops | CHECKOUT, WALK_IN_CREATED, BOOKING_EDITED, RESCHEDULE, CANCEL_BOOKING, DELETE_BOOKING, NO_SHOW, BLOCK_TIME_ADDED/REMOVED, PRODUCT_SALE_CREATED | firestoreActions + BookingDetailPanel/CheckoutPanel/Bookings/BlockTimeForm |
| Müşteri-kaynaklı | BOOKING_CANCELLED_BY_CUSTOMER, BOOKING_RESCHEDULED_BY_CUSTOMER | functions (cancel/reschedule callables) |
| Finans | EXPENSE_ADDED/UPDATED/DELETED, PAYMENT_ADDED/DELETED, INVESTMENT_TX_*, INVESTMENT_REQUIRED_SET, FINANCE_LEDGER_UPLOADED, PARTNER_SETTLEMENT_SIGNED/REVERSED, EXIT_AGREEMENT_* | Finance.tsx + ExitSettlementCard |
| Loyalty | manual_points_adjustment | Clients.tsx |

**Kör noktalar (loglanmayan mutasyonlar):**
- **Barbers:** status/leave (bugünkü vaka!), working hours/dayHours, shiftChanges (off-today/quick block'un shift kısmı), create/delete, renk/rol/order.
- **Clients:** create/edit (alias zinciri dahil!), delete, **merge (drag-drop, yıkıcı)**, consent (Stop/Resume emails), member promote/demote, trusted (gelince).
- **Katalog:** services/products/categories create/edit/delete — **fiyat değişikliği para-etkili**, şu an tamamen iz bırakmıyor.
- **Settings:** permissions (7 izin!), notification toggles, integrations (telegram/stripe), emailConfig, loyalty config, plan/trial (super-admin app).
- **Diğer:** discount codes create/delete, campaign send'leri (campaignsSent subcol'da var ama audit'te değil), staff-user create/delete (functions), gallery/announcements, super-admin panel aksiyonları (cross-tenant!).

## 2. Tasarım

### 2a. Standart zarf (envelope) — tek helper, iki taraf
```
{ action: 'BARBER_STATUS_CHANGED',        // SCREAMING_SNAKE, alan öneki
  actor:  { uid, email, name, role },     // logAudit zaten yapıyor; + role EKLE
  source: 'panel'|'staff-app'|'booking-site'|'function:<fnName>'|'super-admin',
  target: { collection:'barbers', docId, label:'Muhamed' },   // İNSAN-OKUR label ŞART
  changes: { status:['leave','active'], leaveUntil:['2026-07-20',null] },  // önce→sonra, SADECE değişen alanlar
  timestamp: serverTimestamp() }
```
- `changes` özet olmalı (değişen alanlar), full-doc snapshot DEĞİL (maliyet + PII genişlemesi).
- Frontend: `logAudit` genişletilir (source+target+changes paramları; mevcut çağrılar kırılmaz — geriye uyumlu).
- Functions: `logAuditServer(db, tenantId, {...})` ortak helper (şu an 3 yerde el yazması `.add()`).
- Super-admin app: cross-tenant aksiyonlar hedef tenant'ın auditLogs'una `source:'super-admin'` ile yazar.

### 2b. Neyi LOGLAMAYIZ (bilinçli)
- Okumalar/görüntülemeler — asla.
- Makine-hacimli olaylar: parser booking import'ları (externalId+parserStats zaten iz),
  scheduled cleanup'lar, trigger'ların kendi iç yazmaları (loyaltyEmailSent marker vb).
  İstisna: parser bir client DOC'u yaratıyorsa (C5-A) o loglanabilir (kimlik-etkili).
- Booking create (online/walk-in) zaten kapsanıyor; booking doc'unun kendi meta
  alanları (cancelledBy vb) audit'in yerine geçmez ama tekrarına da gerek yok —
  audit SİLME/EDIT gibi yıkıcı/yönetimsel aksiyonlara odaklanır.

### 2c. Güvenlik & yaşam döngüsü
- **Rules: append-only** — create: staff+; update/delete: KİMSE (super-admin dahil;
  düzeltme = yeni kayıt). Read: owner/admin (staff kendi aksiyonlarını görür mü → owner kararı).
- **Retention:** Firestore TTL policy (`expireAt`, öneri 24 ay) — maliyet kontrolü;
  finans/exit kayıtları TTL'siz (yasal değer taşıyabilir).
- Zarfın `changes`'ında sır ASLA (appPassword vb → `changes:{appPassword:['***','***']}`).

### 2d. Viewer (AuditLog.tsx)
Kategori filtresi (Bookings/Finance/Team/Clients/Catalog/Settings) + actor + tarih
aralığı + target-arama. "Muhamed'e ne oldu?" tek sorguda cevaplanmalı.

## 3. Fazlar (dilim = deploy edilebilir, her faz kendi başına değer)
- **Faz A (önce — bugünkü vakanın sınıfı):** barbers (status/leave/hours/create/delete
  + G1 confirm modal birlikte) + clients (edit/delete/merge/consent/member). ~10 çağrı noktası.
- **Faz B:** katalog (fiyat!) + settings (permissions/integrations) + discount codes.
- **Faz C:** staff-user fn'leri + super-admin panel + campaign send + kalanlar + TTL + viewer filtreleri.
- Her fazda TESTS.md'ye manuel doğrulama satırı (aksiyon yap → kaydı gör).

## 4. Bağlar
- ROADMAP **I4** (durum SSOT) · G1 `BARBER_STATUS_CHANGED` = öncü dilim ·
  INCIDENTS 2026-07-12 (tetikleyici vaka) · SECURITY.md (append-only rules değişikliği
  oraya da işlenir) · memory `feedback_firestore_rules_safety` (rules EN SON deploy).
