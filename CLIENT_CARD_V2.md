# CLIENT_CARD_V2 — Client kartı premium redesign + puan-harcama görünürlüğü

> Kaynak: owner istek 2026-07-11 (gece, İngiltere–Norveç maçı arası 😄).
> **Gate: TS migration feature-freeze — kod 2026-07-14'ten önce YAZILMAZ**
> (12=rc3, 13=ürün-doğrulama). İnceleme o gece yapıldı; kod çapaları aşağıda.

## 1. Tespit — veri VAR, görünürlük YOK

Owner'ın sezgisi doğru: harcanan puan/indirim verisi zaten toplanıyor ama
client kartında hiçbir yerde gösterilmiyor.

| Veri | Nerede yazılıyor | Clients'ta durumu |
|---|---|---|
| `loyaltyRedeemedValue` (checkout'ta kullanılan puanın £ değeri) | `CheckoutPanel.tsx:930` (booking doc'una) | **HİÇ OKUNMUYOR** (Marketing.tsx:373 attribution için okuyor, Clients.tsx 0 referans) |
| `totalDiscount` (müşteri başına toplam indirim) | `Clients.tsx:187-188` client aggregation'da HESAPLANIYOR | Stats satırında YOK; sadece history sekmesinde per-booking chip (`:820`) |
| Puan hareketleri | `auditLogs` — ama SADECE `manual_points_adjustment` (`Clients.tsx:292`) | Loyalty sekmesi timeline'ı manuel ayarları gösteriyor; **checkout'ta kazanılan/harcanan puanlar timeline'da YOK** |
| Mevcut bakiye | `clients/{id}.loyaltyPoints` | ✅ gösteriliyor (büyük sayı + progress bar) |

Yani: müşteri 3 kez puan kullanmışsa bunu görmenin tek yolu history'de
booking'leri tek tek açmak. "Bizden ne kadar değer aldı" sorusunun cevabı yok.

## 2. Faz 1 — Loyalty görünürlüğü (ucuz: SIFIR yeni Firestore read)

Booking'ler client'a zaten join'li (aggregation `Clients.tsx:174-215`) —
hepsi client-side türetilebilir:

1. **Lifetime şeridi (Loyalty sekmesi, bakiye kartının altına):**
   `Points used (£X)` = Σ `loyaltyRedeemedValue` · `Discounts (£Y)` =
   mevcut `totalDiscount` · `Total value received (£X+Y)`.
2. **Birleşik timeline:** manuel ayarlar (mevcut pointsLog) + checkout
   redemption'ları (`bookings.filter(b => b.loyaltyRedeemedValue > 0)` →
   tarih + "−N pts · £V off · <service>") + isteğe bağlı ziyaret-başı kazanım
   satırı (earn rate tenant config: `loyalty.earnRate`, cashback `points/20`
   legacy fallback — bkz. salown-app/CLAUDE.md Money & loyalty).
3. **Stats satırı (üst):** `Points` kutusuna ikinci satır: "£X used lifetime"
   (veya 4'lü kutuya 5. kutu "£ saved" — tasarım kararı).

## 3. Faz 2 — Premium kart redesign (owner: "çok küçük görünüyor")

Mevcut: orta boy panel; 4'lü stats; 3 sekme (overview/history/loyalty);
edit = basit ortalanmış modal (`Clients.tsx:1047`, düz input listesi).

Yön (Campaigns redesign diliyle aynı ruh — per-client drawer kalıbı zaten var):
- **Full-height drawer** (sağdan, geniş) — küçük panel yerine.
- **Hero header:** initials-avatar (source-renk halkası), isim + member rozeti
  (◆ tier) + telefon/email hızlı-aksiyonlar (tel:/mailto: zaten history
  hover-card'da var, kalıp hazır).
- **Stats bandı büyür:** Visits · Total Spent · Avg/Visit · Points · **£ Saved**.
- **Inline edit:** ayrı modal yerine hero'da kalem ikonu → alanlar yerinde
  edit'e döner (mevcut modal mantığı — alias arrayUnion `:433`, booking
  rename `:440` vb — AYNEN korunur, sadece sunum değişir).
- **Quick actions satırı:** New booking · Send email · Adjust points ·
  (super-admin: merge/delete — mevcut yetki gate'leri DEĞİŞMEZ).

## 4. Korunacaklar (dokunma)

- Delete/merge = super-admin gate'leri (`useAuth().isSuperAdmin`) AYNEN.
- Edit'teki `_aliases` arrayUnion + `_origName` + booking-rename zinciri
  (`Clients.tsx:421-447`) davranışsal olarak birebir kalır.
- Kimlik eşleştirme sırası (clientManualId → phone/email → aliases → name)
  — NORMALIZATION.md standartları.
- MemberZone promote/demote akışı (puan sıfırlama onayı dahil).

## 5. Efor / sıra önerisi

- **Faz 1** küçük (tek dosya, client-side derive) → migration sonrası ilk
  uygun dilim; hemen değer üretir ("bu müşteri bizden £X değer aldı").
- **Faz 2** orta (tasarım işi; SERVICE_EDITOR_DESIGN_BRIEF kalıbıyla önce
  brief/mockup, owner onayı, sonra kod). Faz 1'i bekletmesin — ayrı dilimler.
