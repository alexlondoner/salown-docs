# Staff Management & Compensation — Tasarım Review + UI Prompt'u (v2)

> **Nasıl kullanılır:** Yeni bir Claude oturumuna (Claude design) İKİ dosyayı birlikte yapıştır:
> **(1) bu dosya + (2) [STAFF_MANAGEMENT_DESIGN.md](STAFF_MANAGEMENT_DESIGN.md)** (mevcut v1 tasarım).
> Çıktı = iki bölümlü doküman: **A. Tasarım Review Raporu** + **B. Staff Hub UI/UX Tasarımı**.
> Kod YAZDIRMA. Owner: whitecrossbarbers@gmail.com.
>
> *v2 notu (2026-07-14):* v1 prompt "sıfırdan tasarım ürettir" idi ve çalıştırıldı — çıktısı
> STAFF_MANAGEMENT_DESIGN.md olarak bu repoda (kod haritası satır-atıflı doğrulanmış durumda).
> Bu v2, [PROJECT_BRIEF.md](PROJECT_BRIEF.md)'in ürün bağlamı ile v1'in spesifikasyonunu birleştirir
> ve görevi "aynı işi tekrar yap"tan **"mevcut tasarımı zorla + UI'ını çıkar"a** çevirir.

---

## Rol

Sen iki şapkalı çalışacaksın: **(A) kıdemli SaaS ürün mimarı / veri modelcisi** — mevcut tasarımı
adversarial review edeceksin; **(B) kıdemli product designer** — modülün ekran tasarımını çıkaracaksın.

## Ürün bağlamı (repo erişimin yok — bu bölüm kendi başına yeter)

**salOWN** — çok-kiracılı (multi-tenant) salon/barber yönetim SaaS'ı: booking, ödeme, loyalty,
bildirimler, personel mobil uygulaması, admin panel, raporlama.

- **Stack:** React + Vite + strict TypeScript · Firebase (Firestore, Cloud Functions
  `europe-west2`, Hosting; proje `havuz-44f70`). Tüm tenant verisi `tenants/{tenantId}/...` altında.
- **3 canlı tenant:** `whitecross` (premium pilot — her özellik önce burada), `herohairs`, `eekurt`.
  Gerçek kullanım var: günlük online booking, loyalty redeem, transactional mail trafiği.
- **Yüzeyler:** admin panel (salown.com) · salOWN-hosted booking/profil · whitecross premium sitesi
  (ayrı statik repo) · staff mobil app (staff.salown.com).
- **Deploy:** main'e push → CI otomatik hosting deploy. Değişiklikler önce whitecross pilotunda.

## İş problemi

Personel **farklı ödeme modelleriyle** çalışıyor; sistem bugün yalnız sabit günlük wage biliyor
(whitecross'a özel Finance sayfasındaki isim-anahtarlı `partnerConfig`). Gerçek dünya (UK):

- **wage** — sabit £/gün-hafta-ay; dükkan tüm hizmet gelirini alır, maaş sabit gider.
- **commission** — kişi ürettiği NET cironun %'sini alır (hizmet/ürün ayrı %); dükkan geliri = ciro − komisyon.
- **self-employed / koltuk kiracısı** — kişinin cirosu **dükkanın geliri değil**; dükkan kira
  (sabit £ VEYA cironun %'si) toplar. UK yasal ayrımı: self-employed'a maaş/vardiya işletirsen
  employee'ye döner (vergi/istihdam riski) — model bunu yapısal korumalı.

Üç model P&L'i bambaşka hesaplattığı için birinci-sınıf, multi-tenant bir **Staff Management**
modülü gerekiyor.

## Mevcut kod gerçekleri (tasarım bunlara oturdu — review'da varsay)

- `partnerConfig` = `tenants/whitecross/settings/finance_config` içinde, **isim-anahtarlı**:
  `{share, wage, isPartner, creditTo, startDate}`. Config'siz gerçek barber'a **örtük £100/gün
  fallback** var (tehlikeli default). Finance route/sidebar'da `tenantId==='whitecross'` hardcode.
- **Barber doc'ları world-readable** (`firestore.rules` `read: if true` — public booking siteleri
  okuyor). Comp verisi bu doc'a KONAMAZ.
- Lifecycle CANLI ve sağlam (G5, 2026-07-13/14): `status: active|leave|passive` + tarih-aralıklı
  `leaveFrom/Until` + `leaves[]` izin arşivi + otomatik dönüş. Tek resolver önceliği (owner kararı):
  **`shiftChanges (açık) > leave > passive > workingDays/dayHours`** — izin içine girilen açık
  özel-gün ÇALIŞIR ve ücrete sayılır.
- Ciro ataması **isim-bazlı** (`normalizeName`); booking'ler `barberName` snapshot'lıyor (silinen
  barber'ın geçmişi isimle kalır). Walk-in tuhaflığı: `barberId` = küçük-harf İSİM; online = doc id.
- Net ciro helper'ı paylaşık: `bookingNetWithoutTip` (price + serviceCharge + ürün/addon − discount −
  loyalty; **tip hiçbir hesapta yok**, bahşiş personelin).
- **Bilinen 2 bug (tasarım yapısal çözüyor — review'da doğrula):** (1) passive barber Finance'ta
  hâlâ günlük maaş tahakkuk ediyor; (2) izindeki barber occupancy kapasite paydasında sayılıyor.
- Kısıtlar: Firestore'da toplu silme yok (export → dry-run CSV → owner onayı → yaz); booking para
  alanlarının semantiği değiştirilemez; para/semantik değişikliği = önce rapor + owner onayı.

## GÖREV A — Tasarım Review Raporu

Ekteki **STAFF_MANAGEMENT_DESIGN.md** (v1) için:

1. **Açık soruları cevapla (v1 §8'deki 4 soru):** komisyon brüt/net tabanı (+ aggregator kaynaklı
   booking'lerde platform kesintisi), izinde kira default'u, `guaranteeMin` v1'e girsin mi, staff'ın
   kendi komisyon görünümü. Her birine gerekçeli öneri + karşı-senaryo.
2. **Adversarial zorla:** veri şeması (`staffComp/{barberId}`, append-only `history[]`,
   "passive = dönem kapalı"), hesap kuralları (§2 formülleri, gün-orana indirgeme), göç planı (M1–M4
   parity yaklaşımı), rules bloğu. Nerede kırılır? Hangi edge case eksik? Firestore okuma-maliyeti /
   index ihtiyacı / offline-cache açısı? Her bulguyu **CONFIRMED** (somut senaryoyla kırılıyor) /
   **PLAUSIBLE** (riskli ama senaryo kuramadın) olarak etiketle.
3. **Eksik parça avı:** tasarımın hiç değinmediği ama bu modülün scale'de ihtiyaç duyacağı şeyler
   (örn. çoklu-lokasyon, saatlik ücret, bordro export'u) — "v2 park listesi" olarak öner, kapsamı
   şişirme.

## GÖREV B — Staff Hub UI/UX Tasarımı

v1 §4'teki kaba iskeleti gerçek ekran tasarımına dönüştür (v1'in veri modeli/fazlaması SABİT —
UI onu değiştiremez):

- **Ekran envanteri:** roster listesi + personel detay paneli (Availability / Pay / History
  sekmeleri) + "Eski personel" arşiv bölümü + comp değiştirme akışı (tip seç → paramlar →
  effectiveFrom → onay) + lifecycle aksiyonları (leave/passive/delete, mevcut güçlü-onay modalı korunur).
- **Her ekran için:** markdown/ASCII wireframe + durum matrisi (boş/dolu/hata/yükleniyor;
  comp-tanımsız uyarısı; izinli/pasif rozetleri) + mikro-copy önerileri (İngilizce UI metni).
- **Rol görünürlüğü:** Pay sekmesi yalnız owner + super-admin; admin/staff sekmeyi hiç görmez.
  Tenant'ta comp tanımsızsa boş-durum.
- **3 comp tipinin görsel dili:** tip başına ayırt edici özet kartı (wage £/gün · commission %'ler ·
  self-employed kira + "cirosu şirket geliri değildir" ibaresi) — owner tabloya bakınca kimin ne
  modelde olduğunu 2 saniyede ayırt etmeli.
- **Panel deseni:** mevcut salOWN admin paneliyle uyum (dark + light ikisi de), mobil-uyumlu;
  "sadece görsel" kuralı — mevcut davranışları yeniden tasarlama, yerleşim/hiyerarşi/akış tasarla.

## İstenen çıktı formatı

Tek markdown doküman, iki bölüm: **A. Review Raporu** (bulgular CONFIRMED/PLAUSIBLE etiketli,
açık-soru cevapları, v2 park listesi) + **B. UI Tasarımı** (ekran envanteri, wireframe'ler, durum
matrisleri, copy). Kod yazma; Firestore rules/şema önerilerini metin olarak ver. Çıktı bu repoya
(`salown-docs`) işlenecek ve kod fazları (A/B/C, v1 §7) bu dokümana göre yürüyecek.
