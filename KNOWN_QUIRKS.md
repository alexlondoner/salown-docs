# KNOWN_QUIRKS.md — tuhaf ama kasıtlı, dokunma

> **Bu dosya nedir:** Sezgiye aykırı görünen ama **kasıtlı / kabul edilmiş** davranışlar. Amaç: yeni bir session (veya insan) bunları "bug" sanıp "düzeltmeye" kalkıp bir şeyi kırmasın.
>
> **INVARIANTS vs QUIRKS vs latent bug — farkı bil:**
> - [INVARIANTS.md](INVARIANTS.md) = bozulmaması gereken kural ("hep böyle YAP").
> - **KNOWN_QUIRKS (bu dosya)** = tuhaf ama doğru, bilerek böyle ("şaşırma, DOKUNMA").
> - [NORMALIZATION.md](NORMALIZATION.md) → "Bilinen Tutarsızlıklar" = gerçek **latent bug**, düzeltilmeli (quirk DEĞİL).
>
> **Yeni bir "bug" bulduğunu düşünüyorsan:** önce burada ve [INCIDENTS.md](INCIDENTS.md)'de ara. Burada yazıyorsa kasıtlıdır — düzeltmeden önce sor.

**Kolonlar:** Davranış · Neden böyle (kasıtlı) · Dokunursan ne olur · Kaynak.

---

## İçindekiler
1. [Veri Modeli](#1-veri-modeli)
2. [Parser & Aggregator](#2-parser--aggregator)
3. [Güvenlik & Public Sayfalar](#3-güvenlik--public-sayfalar)
4. [UI & Grid](#4-ui--grid)
5. [Deploy & Altyapı](#5-deploy--altyapı)
6. [Geçici Quirk'ler (bir faz sonra düzelecek)](#6-geçici-quirkler-bir-faz-sonra-düzelecek)

---

## 1. Veri Modeli

| Davranış | Neden böyle (kasıtlı) | Dokunursan | Kaynak |
|----------|----------------------|-----------|--------|
| Walk-in booking'de `date` alanı **YOK**, sadece `startTime` (Timestamp) | `createWalkIn` böyle yazıyor; walk-in anlıktır | Date-based query walk-in'leri **kaçırır** → `startTime` range ile sorgula | CLAUDE §Booking |
| `barberId` tutarsız: walk-in = lowercase barber **adı**; online = barber **doc id** + `barberName` | İki farklı yazma yolu, tarihsel | Tek forma göre eşlersen yarısı düşer → **ikisini de** eşle | CLAUDE §Booking |
| `endTime` şekli değişken: Dashboard = label **string**; Bookings.jsx/Clients.jsx = raw **Timestamp** | Farklı ekranlar farklı üretti | `conflictUtils.getExistingRangeMinutes` ikisini de handle eder — kendi parse'ını yazma | CLAUDE §Booking |
| `bookingId` = `WCB-…` / `SALE-…` / `BLOCKED-…` — Firestore **doc id DEĞİL** | İş-anlamlı id + doc id ayrı | Doc id sanıp `doc(id)` ile okursan bulunmaz | CLAUDE §Booking |
| `price` alanı bazen para-simgeli string (`"£20.00"`) — import kalıntısı | Booksy/Fresha/Treatwell import mirası | Ham `Number()` → `NaN` → `pp()` kullan (INV-PARA-1) | INC 2026-06-22 |
| Finance `dateKey`'i stored alandan değil `startTime`'dan **türetir** | Parser dateKey yazmasa da booking görünsün | "dateKey neden yok" diye ekleme; türetme kasıtlı | INC 2026-06-26 |
| `reset service` = tüm servisleri sil + refresh → `config.js`'ten **21 hardcoded servis auto-seed** | Pilot hızlı sıfırlama | "Servisler silindi/geri geldi" panik yapma; tasarım bu | [reset services](FEATURE_FLAGS.md) |

## 2. Parser & Aggregator

| Davranış | Neden böyle (kasıtlı) | Dokunursan | Kaynak |
|----------|----------------------|-----------|--------|
| Treatwell booking **per-booking** prepaid VEYA pay-at-venue olabilir (global ayar değil) — `twPaymentMode` email `Status`'tan gelir | Gerçek dünyada ikisi karışık | Tek global `paymentType` gösterirsen yanlış (çift-tahsilat riski) → "Both" modu | INC 2026-06-26 |
| Aggregator barber adı formatı tenant ile aynı **olmayabilir** (Treatwell tam ad, sistem ilk ad) | Platformlar tam ad gönderir | Matcher'a fuzzy ekleme → parser'da kanonik isme map'le | INC 2026-06-26 |
| `salownIcalFeed` **source=`Treatwell`** booking'leri feed'e KOYMAZ (bilerek atlar) | Treatwell o randevuya zaten sahip; feed'e koyarsak Treatwell'de **çift** görünür (kendi randevusu + bizim blok) | "Treatwell booking'leri feed'de yok, ekleyeyim" deme → çift-görüntü geri gelir. Diğer TÜM source (walk-in/web/Booksy/Fresha/BLOCKED/busy-time) feed'de kalır, Treatwell çift-booking yapmaz | `index.js` salownIcalFeed; edit_log 2026-07-07(c) |
| `checkDuplicateInFirestore` (whitecross-site) locked rules altında **fails-open** | Booking'i düşürmemek > mükemmel dedup | "Neden hep true dönüyor" diye kırma; kabul edilebilir, booking devam eder | INCIDENTS §Notlar |
| Whitecross Stripe hâlâ `whitecross-site/functions` (**us-central1**), salown-app'te değil | Migration henüz Phase 5 değil | salown-app'e Stripe eklerken whitecross akışını karıştırma | CLAUDE §Related repos |

## 3. Güvenlik & Public Sayfalar

| Davranış | Neden böyle (kasıtlı) | Dokunursan | Kaynak |
|----------|----------------------|-----------|--------|
| `tenants/{id}` root doc **world-readable** (herkese açık) | Public booking sayfası tenant meta'sını okumalı | Buraya sır koyma (INV-SEC-3); public read'i "kapatayım" deme, booking sayfası kırılır | [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md) |
| `success.html` booking'i **`sessionStorage.pendingBooking`**'ten okur (Firestore'dan değil) | Booking read auth-only (GDPR); public sorgu 403 | "Neden Firestore'dan okumuyor" diye değiştirme → 403 boş ekran döner. Çıplak `?id=` URL yeni sekmede çalışmaz (normal) | INC 2026-06-26 |
| Booking read 403 dönüyor (giriş yapmadan) | GDPR — booking PII auth-gated | Bu bir bug değil; public okuma AÇMA | INC 2026-06-26 |
| `salownGetBusySlots` + `salownRescheduleByToken` expired PENDING (`expiresAt < now`) booking'i **skip** eder | Abandoned Stripe session 0–20dk slot ghost-block etmesin | Skip'i kaldırma → terk edilmiş ödemeler slot kilitler | INCIDENTS §Notlar |

## 4. UI & Grid

| Davranış | Neden böyle (kasıtlı) | Dokunursan | Kaynak |
|----------|----------------------|-----------|--------|
| Booking kartı: **arka plan = source rengi**, sol kenar (3px) = **barber rengi** | 2026-06-14 bilinçli redesign; `sourceColors.js` tek kaynak | "Renkler karışmış" diye değiştirme; ikili kodlama kasıtlı | [source badges](FEATURE_FLAGS.md) |
| Checked-out kart `min(scheduled, actual)` ile **sadece kısalır**, uzamaz | Geç checkout kartı şişirmesin (cascade) | Cap'i kaldırırsan INC 2026-06-27 geri gelir (🔴 Regressed) | INC 2026-06-27 |
| `actualDuration` = booking başlangıcı ↔ **checkout'a basma anı** (servisin gerçek süresi değil, clamp 5..240dk) | Squeeze-in için "erken bitti, slotu boşalt" sinyali | Servis süresi sanıp kapasite/çakışmada ham kullanma → cap'le (INV-BK-5) | INC 2026-06-27 |

## 5. Deploy & Altyapı

| Davranış | Neden böyle (kasıtlı) | Dokunursan | Kaynak |
|----------|----------------------|-----------|--------|
| `hosting/public-bundle/` ve `staff-bundle/` **gitignored** (build output) | Artefakt commit'lenmez; predeploy hook üretir | Elle düzenleme boşa gider; ham `firebase deploy` (build atlayan) bundle'ı siler | INC 2026-06-29 |
| `FORCE_SALOWN_SENDER_TENANTS=['whitecross']` → whitecross email'i Brevo `noreply@salown.com`'dan gider | Multi-tenant email birleştirme | Bu listeden çıkarırsan whitecross email göndericisi değişir | INC 2026-06-26 · [EMAIL_ARCHITECTURE.md](EMAIL_ARCHITECTURE.md) |
| barber-panel / barber-mobile = **LEGACY**; FCM disabled 2026-06-19. Canlı staff = `staff.salown.com` (Salown Staff App) | salown-app'e taşındı | Eski panellere feature ekleme; salown-app'te yap | CLAUDE §Notification · [whitecross tenant](MULTI_TENANT_NOTES.md) |
| `alex/` kökü git repo **değil**; `docs/` ayrı `salown-docs` (private) repo; app'ler ayrı repo | Bilinçli çok-repo yapısı | Kökü `git init` etme (nested repo karmaşası) | [DECISIONS.md](DECISIONS.md) 2026-07-02 |

## 6. Geçici Quirk'ler (bir faz sonra düzelecek)

> Bunlar kasıtlı ama **kalıcı değil** — ilgili faz gelince düzeltilecek. O zamana kadar "böyle bırak".

| Davranış | Ne zaman düzelecek | Kaynak |
|----------|-------------------|--------|
| `salownNotifyBookingCreated` PENDING bookings için de Telegram gönderiyor | Phase 5 (Stripe aktif) olunca | CLAUDE §Notification |
| Deposit flow INCOMPLETE: webhook yok, `expiresAt` yok → `features.stripe` / `websiteDepositsEnabled` **AÇMA** | Phase 5 | CLAUDE §Deposit · [BUSINESS_RULES](BUSINESS_RULES.md) |
| Finance/Reports kart/nakit bahşiş ayrımı hâlâ servis `paymentMethod`'unu kullanıyor (staff app düzeltildi) | `tipPaymentMethod` helper'ına geçiş (whitecross onayı bekliyor) | INC 2026-06-28 |
| app-password Settings'te düz metin saklanıyor (sızıntı kapalı ama saklama plain) | Secret Manager'a taşıma (T-b) | [security sprint](SECURITY.md) |

---

## Bakım
- Bir davranış "tuhaf ama kasıtlı" olduğu her anlaşıldığında (özellikle bir session onu "bug" sanıp sorduğunda) buraya ekle.
- Bir quirk **gerçekten** düzeltilmesi gereken bir bug'a dönüşürse → [NORMALIZATION.md](NORMALIZATION.md) "Bilinen Tutarsızlıklar"a veya bir ROADMAP maddesine taşı, buradan çıkar.
- Geçici quirk düzeltilince (Bölüm 6) satırı sil + ilgili incident/karar kaydını güncelle.
- Commit: `cd alex/docs && git commit KNOWN_QUIRKS.md && git push`.
