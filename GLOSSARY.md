# GLOSSARY — Salown terimler sözlüğü

> **Bu dosya nedir:** Projede geçen jargon, kısaltma ve kod terimlerinin tek-satır karşılıkları. Yeni katılan biri (PM/mühendis/tasarımcı) bir terimde takıldığında buraya bakar.
>
> **Nasıl kullanılır:** `Ctrl/Cmd+F` ile terimi ara. Derin detay gerekiyorsa sağdaki **detay** linkine git. Yeni bir terim/kısaltma yaygınlaşınca buraya bir satır ekle.

**Not:** Marka her zaman **salOWN** yazılır (asla "salown"/"Salown") — dokümanlarda bazen düz metinde "Salown" geçse de doğru form salOWN'dur.

---

## 🏢 Ürün & İş (Domain)

| Terim | Anlamı | Detay |
|-------|--------|-------|
| **Tenant** | Platformdaki bir salon (müşteri). Tüm verisi `tenants/{tenantId}/...` altında | [MULTI_TENANT_NOTES](MULTI_TENANT_NOTES.md) |
| **Multi-tenant** | Tek kod tabanının birçok salonu izole şekilde barındırması | [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md) |
| **`tenantId`** | Salonu tanımlayan kimlik; Firebase **custom claim**'de (JWT), app-state'te değil | [TENANTS](TENANTS.md) |
| **Class A / Class B** | Tenant olgunluk/migration sınıfı. Tüm aktif tenantlar Class A (whitecross 2026-06-19 tamamlandı) | [TENANTS](TENANTS.md) |
| **Grabbing** | Salown felsefesi: mevcut kanalların (Booksy/Fresha/Treatwell) yerini almaz, **birleştirir** | [MANIFESTO](MANIFESTO.md) |
| **Aggregator** | Dış rezervasyon platformu (Booksy, Fresha, Treatwell) — email parser ile içeri çekilir | [PARSER_NOTES](PARSER_NOTES.md) |
| **Walk-in** | Randevusuz gelen müşteri; `createWalkIn` ile girilir (`date` alanı YOK, sadece `startTime`) | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **Squeeze-in** | Boş bırakılmış gap'e küçük servis sıkıştırma (processing-time'dan doğdu) | [BUSY_SLOT_V2](BUSY_SLOT_V2.md) |
| **Processing time** | Servisin fiziksel olarak boş (kuaför meşgul değil) ara süresi; gap-fill motoru bunu kullanır | [BUSY_SLOT_V2](BUSY_SLOT_V2.md) |
| **Busy-slot v2** | Çok-aralıklı müsaitlik motoru (processing time destekli) | [BUSY_SLOT_V2](BUSY_SLOT_V2.md) |
| **No-show** | Gelmeyen müşteri | [BUSINESS_RULES](BUSINESS_RULES.md) |
| **Deposit / prepaid / pay-at-venue** | Ödeme modları: ön ödeme / peşin ödenmiş / mekanda öde. Aggregator per-booking değişebilir | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **Loyalty / cashback / points** | Sadakat sistemi; `loyalty.cashbackPct` tenant-configurable (`points/20` legacy fallback) | [FEATURE_FLAGS](FEATURE_FLAGS.md) |
| **Ask salOWN** | Uygulama içi AI asistanı; `askAI` callable, **Claude Haiku 4.5** | [DECISIONS](DECISIONS.md) ADR-014 |

## 👥 Tenant'lar & Kişiler

| Terim | Anlamı |
|-------|--------|
| **Whitecross** | İlk/pilot tenant (I CUT Whitecross Barbers); premium tenant (custom domain whitecrossbarbers.com) |
| **HeroHairs** | Hairdresser tenant; processing-time/squeeze-in pilot'u |
| **EeKurt** | Tenant 2 |
| **I CUT** | Whitecross'un işletme adı (başlangıç noktası) |
| **Barber vs Stylist/Hairdresser** | Barber = erkek kuaförü (Whitecross); hairdresser = processing-time'lı kuaför (HeroHairs) |

Kişiler/roller/emailler → [PEOPLE](PEOPLE.md).

## 🔧 Teknik — Firebase & Backend

| Terim | Anlamı | Detay |
|-------|--------|-------|
| **`havuz-44f70`** | Firebase proje id'si (region `europe-west2`) | [SYSTEM_ARCHITECTURE](SYSTEM_ARCHITECTURE.md) |
| **Custom claim** | JWT içindeki yetki verisi (`tenantId`, `isSuperAdmin`, `tenantRole`) | [SECURITY](SECURITY.md) |
| **`isSuperAdmin`** | Platform sahibi claim'i (şu an tek: aerulas@). Silme/staff-atama yetkisi buna bağlı | [DECISIONS](DECISIONS.md) ADR-006 |
| **`tenantRole`** | Tenant içi rol: owner > admin > staff | [SECURITY](SECURITY.md) |
| **Callable / onCall** | Auth'lu client'ın çağırdığı Cloud Function (Admin SDK ile rules'ı baypas edebilir) | — |
| **onRequest** | HTTP endpoint tipi function (ör. `addToWaitlist`, `salownEmailOptOut`) | — |
| **Trigger** | Firestore olayında otomatik çalışan function (ör. `salownNotifyBookingCreated`) | — |
| **IMAP parser** | Salon Gmail'ini IMAP+regex ile okuyan cron (`salownParseEmails`); aggregator email'lerini içeri çeker | [PARSER_NOTES](PARSER_NOTES.md) |
| **`externalId`** | Aggregator booking'inin benzersiz kimliği; dedup için (re-run güvenli) | [PARSER_NOTES](PARSER_NOTES.md) |
| **Tombstone** | Silinmiş/işlenmiş kaydı işaretleyen iz; duplicate'e karşı son güvenlik ağı | [INCIDENTS](INCIDENTS.md) (Jakov) |
| **Canary** | "Beklenenden az import → alarm" sessiz-kırılma dedektörü (parser için, ROADMAP I1) | [ARCHITECTURE_REVIEW_2026-07-02](ARCHITECTURE_REVIEW_2026-07-02.md) |
| **Brevo** | Transactional/loyalty email sağlayıcısı (`noreply@salown.com`) | [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) |
| **nodemailer** | Tenant Gmail üzerinden confirmation/cancel/reschedule email'i | [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) |
| **FCM** | Firebase Cloud Messaging — staff app push bildirimi (`fcmTokens/`) | — |
| **Telegram (notifyTenant)** | Tenant'a booking bildirimi; `settings/integrations`'tan token okur | — |
| **Capacitor** | Web app'i native mobil app'e saran katman (Tap to Pay için gerekli) | [DECISIONS](DECISIONS.md) ADR-005 |
| **Stripe Connect / Checkout Session** | Seçilen ödeme yönü (per-tenant policy; Payment Link DEĞİL) | [STRIPE_CONNECT_PLAN](STRIPE_CONNECT_PLAN.md) |
| **Tap to Pay** | Telefonu kart makinesi yapan Stripe özelliği (POS pilot yönü) | [DECISIONS](DECISIONS.md) ADR-005 |

## 🚀 Deploy & Altyapı

| Terim | Anlamı | Detay |
|-------|--------|-------|
| **Bundle / public-bundle / staff-bundle** | Build çıktısı (gitignored); `hosting/`'ten servis edilir. Build atlanırsa SPA 404'e düşer | [INCIDENTS](INCIDENTS.md) 2026-06-29 |
| **Predeploy hook** | `firebase.json`'da her deploy öncesi otomatik `npm run build` (bundle düşmesin) | [DECISIONS](DECISIONS.md) ADR-010 |
| **CI** | GitHub Actions — `salown-app` main'e push = otomatik hosting deploy | [DEPLOY](DEPLOY.md) |
| **Vite / CRA** | salown-app = Vite (.jsx, aktif); salown-panel = CRA (.js, legacy) | [DECISIONS](DECISIONS.md) ADR-001 |
| **Smoke test** | Deploy sonrası kritik rota 200 kontrolü (fail → deploy fail) | [INCIDENTS](INCIDENTS.md) 2026-06-29 |

**Domain'ler:** `salown.com` (consumer booking) · `hub.salown.com` (partner portal / panel) · `admin.salown.com` (super-admin) · `staff.salown.com` (Salown Staff App).

## 🗂️ Repo'lar

| Repo | Ne | Durum |
|------|-----|-------|
| **salown-app** (`Salown.git`) | Ana kod — Vite + .jsx | ✅ aktif |
| **super-admin** (`salownadmin.git`) | Süper-admin panel | ✅ aktif |
| **whitecross-site** (`whitecross-site.git`) | Whitecross premium + legacy Stripe (us-central1) | 🟡 aşamalı emeklilik |
| **salown-docs** (`salown-docs.git`) | Bu repo — proje beyni (private) | ✅ aktif |
| **salown-panel** | Eski CRA panel | ⛔ legacy |
| **barber-panel / barber-mobile** | Whitecross eski paneller (FCM disabled) | ⛔ legacy |

## 📐 Süreç & Dokümantasyon terimleri

| Terim | Anlamı | Detay |
|-------|--------|-------|
| **SSOT** | Single Source of Truth — bir bilginin tek yaşadığı yer (durum → ROADMAP; testler → TESTS) | [ROADMAP](ROADMAP.md) |
| **ADR** | Architecture Decision Record — karar + gerekçe + elenen alternatifler | [DECISIONS](DECISIONS.md) |
| **Invariant** | Bozulursa sistem kırılan değişmez kural ("hep böyle yap") | [INVARIANTS](INVARIANTS.md) |
| **Quirk** | Tuhaf ama kasıtlı davranış ("bug sanıp düzeltme") | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **Latent bug** | Henüz patlamamış ama düzeltilmesi gereken hata (quirk DEĞİL) | [NORMALIZATION](NORMALIZATION.md) |
| **Regressed** | Daha önce çözülmüş bir bug'ın geri gelmesi (INCIDENTS Status 🔴) | [INCIDENTS](INCIDENTS.md) |
| **Tier 1/2/3** | Pre-scale hardening öncelik katmanları (Tier 1 = onboarding'den önce kapanmalı) | [SECURITY](SECURITY.md) |
| **Blast radius** | Bir değişikliğin/hatanın etkilediği alanın genişliği | [SECURITY](SECURITY.md) |
| **GDPR / opt-out / unsubscribe** | Veri koruma; email öncesi `emailOptOut !== true`, her mailde unsubscribe | [EMAIL_ARCHITECTURE](EMAIL_ARCHITECTURE.md) |

## 💻 Kod helper'ları (sık geçen)

| Sembol | Ne yapar | Detay |
|--------|----------|-------|
| **`pp()` / `parsePrice()`** | Para string'ini güvenli sayıya çevirir (`£`/virgül temizler, NaN→0, negatifi korur) | [INVARIANTS](INVARIANTS.md) INV-PARA-1 |
| **`toDateKey()`** | UK-güvenli tarih anahtarı (asla `toISOString().split('T')[0]` — BST kayar) | [INVARIANTS](INVARIANTS.md) INV-DATE-1 |
| **`barberKey()` / `matchesBarber()`** | Exact case-insensitive barber eşleşmesi (fuzzy YOK) | [NORMALIZATION](NORMALIZATION.md) |
| **`normalizeBookingStatus()`** | Status'u uppercase'e normalize eder (import lowercase olabilir) | [INVARIANTS](INVARIANTS.md) INV-BK-7 |
| **`_aliases`** | Client'ın eski telefon/email'leri (arrayUnion ile korunur, geçmiş kopmasın) | [INVARIANTS](INVARIANTS.md) INV-MATCH-5 |
| **`clientManualId`** | Client lookup'ta ilk anahtar | [INVARIANTS](INVARIANTS.md) INV-MATCH-4 |
| **`actualDuration`** | Checkout'a basma anı − başlangıç (servis süresi DEĞİL; geometride cap'lenir) | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **`bookingId` prefiksleri** | `WCB-` (walk-in) · `SALE-` · `BLOCKED-` — Firestore doc id DEĞİL | [KNOWN_QUIRKS](KNOWN_QUIRKS.md) |
| **`provisionTenant`** | Yeni tenant kuran fonksiyon (self-onboarding `/signup`) | [DECISIONS](DECISIONS.md) ADR-009 |

---

## Bakım
- Yeni bir terim/kısaltma yaygınlaşınca (özellikle yeni biri "bu ne demek?" diye sorunca) buraya bir satır ekle, mümkünse detay dokümanına link ver.
- Bir terim değişir/ölürse satırı güncelle veya kaldır (ör. legacy repo emekliye ayrılınca).
- Commit: `cd alex/docs && git commit GLOSSARY.md && git push`.
