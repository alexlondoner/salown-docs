# NORMALIZATION.md

Tüm "match yapamama / büyük-küçük harf / normalize" sorunlarının tek referansı.
Geçmişte en çok tekrarlayan bug sınıfı: iki taraf aynı değeri farklı formatta tutuyor →
exact eşleşme başarısız → feature sessizce çalışmıyor (cancel gelmiyor, fiyat boş, history bölünüyor).

**Altın kural:** Karşılaştırmadan önce HER İKİ tarafı da aynı helper'dan geçir. Asla ham `===` ile
kullanıcı/email/parser verisi karşılaştırma.

---

## Normalize Helper'ları (kaynak doğruluk)

| Alan | Helper | Konum | Ne yapıyor | Önlediği bug |
|------|--------|-------|------------|--------------|
| **Servis adı** | `normSvc()` | ⚠️ inline ×5 (aşağı bkz) | lowercase + trim + `&`→`and` + boşluk collapse (+ bazı yerde trailing `s` strip) | "Classic Short Back **and Side**" ≠ "Classic Short Back **& Sides**" |
| **Booking source** | `normalizeBookingSource()` | `src/utils/bookingUtils.js:7` | `'website'/'direct'/'app'` → kanonik (`'Salown'`, `'Client App'` …) | `'website'` vs `'Website'` casing → cancel/cleanup çalışmıyor |
| **Booking status** | `normalizeBookingStatus()` | `src/utils/bookingUtils.js:19` | UPPERCASE'e çevirir | import'tan gelen `'checked_out'` ≠ `'CHECKED_OUT'` |
| **Barber** | `barberKey()` | `src/utils/barberUtils.js:25` | `trim().toLowerCase()` | walk-in = lowercase isim, online = doc id; id VEYA isim eşleşmeli |
| **Telefon** | `normalizePhone()` | `src/pages/Clients.jsx:220` | boşluk/`-()+` strip, son 10 rakam | UK formatları (`+44`, `0…`, boşluklu) farklı string → duplicate client |
| **Email** | `.toLowerCase().trim()` | `src/firestoreActions.js` (dedup) | lowercase + trim | `Alex@x.com` ≠ `alex@x.com` → duplicate / merge başarısız |
| **İsim (aksan)** | `stripAccents()` | `src/firestoreActions.js:10` | NFD + U+0300–U+036F strip (`Zorić`→`Zoric`) | aksanlı Booksy ismi ≠ direkt kayıt → history bölünür |
| **İsim (rename)** | `_origName` öncelikli match | `whitecross-site` Clients | yeniden adlandırılan client'ı booking'lere bağlar | "Ozcem" → "OZCEM delibas" rename'de history kaybı |
| **Tarih (key)** | `toDateKey()` | ⚠️ inline ×4 (aşağı bkz) | `YYYY-MM-DD` local time | `.toISOString()` BST'de gün kaydırır |
| **Çalışma günü/saati** | object→array + key case | self-signup + Dashboard defensive | `{monday:true}` → `['Monday',…]`; `settings/hours` key `Monday`→`monday` | dükkân-kapalı günler yanlış; eski tenant doc uyumsuz |

---

## ⚠️ Bilinen Tutarsızlıklar (latent bug — düzeltilmeli)

### normSvc 5 yerde inline ve AYNI DEĞİL
| Konum | trailing `s` strip? |
|-------|---------------------|
| `functions/index.js:1585` (Booksy) | ❌ HAYIR |
| `functions/index.js:1772` (Booksy reschedule) | ❌ HAYIR |
| `functions/index.js:2079` (Fresha new) | ✅ EVET |
| `functions/index.js:2324` (Treatwell) | ❌ HAYIR |
| `src/components/BookingDetailPanel.jsx:420` | ✅ EVET |

**Sonuç:** Aynı servis adı, hangi parser/ekrandan geçtiğine göre farklı eşleşiyor. Örn.
"Classic Short Back & Sides" → Fresha (2079) match eder, Booksy (1585) etmez. **Çözüm:** tek
bir `normSvc` helper'a çıkar (örn. `src/utils/serviceUtils.js` + functions tarafında shared),
trailing `s` davranışını sabitlе. Henüz yapılmadı.

### toDateKey 4 dosyada kopyalanmış
`timeUtils.js:32` (kanonik), ama `Calendar.jsx:18`, `Home.jsx:15`, `Finance.jsx:43` kendi
kopyasını tutuyor. Hepsi aynı mantık ama drift riski → `timeUtils`'ten import edilmeli.

---

## 🎯 Parser Matching Standard (TASLAK — onay + ChatGPT önerileri bekliyor)

> **Neden kritik:** Salown aggregator olma yolunda. Booksy/Fresha/Treatwell direkt API verene kadar
> tek veri kaynağımız email parser'ları. Matching %100 olmalı — yanlış eşleşme = yanlış müşteriye
> booking, çift kayıt, kayıp history. Bu standart tüm parser + client identity karşılaştırmaları için
> bağlayıcı olacak.

**Her karşılaştırılan değer şu kanonik forma sokulur, SONRA karşılaştırılır:**

| Boyut | Kanonik kural | Örnek |
|-------|---------------|-------|
| **Büyük/küçük harf** | her şey `toLowerCase()` | `ARDA` = `arda` |
| **& / and** | `&` → `and`, çoklu boşluk → tek | `Back & Sides` = `back and sides` |
| **Trailing s / çoğul** | servis adında trailing `s` strip (TEK kuralda sabitle) | `Side` = `Sides` |
| **Fiyat** | sayıya çevir: `£`, virgül, boşluk strip → `parseFloat`; **numeric karşılaştır** | `£28` = `28` = `28.00` = `28,00` |
| **Aksan** | `stripAccents()` (NFD + diacritic strip) | `Zorić` = `Zoric` |
| **İsim** | lowercase + trim + aksan strip + çoklu boşluk → tek | `Damian  Adams-Peatling` = `damian adams-peatling` |
| **Telefon** | rakam dışı her şey strip → **son 10 hane** (birincil) | `+44 7700 900123` = `07700900123` |

### ⚠️ Telefon "son 4 hane" — DİKKAT (mühendislik uyarısı)
Son 4 hane = sadece 10.000 kombinasyon. Yüzlerce müşterili bir salonda **çakışma neredeyse kesin**
→ son-4 TEK BAŞINA eşleştirme kriteri olursa **farklı kişileri birbirine karıştırır** (yanlış merge).
**Önerilen kullanım:**
- **Birincil:** son **10 hane** tam eşleşme (neredeyse benzersiz, güvenli).
- **Son 4 hane yalnızca DESTEK sinyali:** normalize isim + son-4 birlikte tutuyorsa "güçlü eşleşme".
  Tek başına son-4 ile asla merge/iptal etme.
- Bir kaynak telefonu kırpık/eksik veriyorsa (ör. 7 hane), son-4 + isim + tarih/saat üçlüsüyle doğrula.

### İsim matching kuralı (mevcut politika ile uyum)
- İsim, **contact bilgisi (telefon/email) varken TEK BAŞINA** eşleştirme kriteri DEĞİL (yanlış merge riski).
  Bkz: client identity lookup sırası.
- İsim normalize edilir (yukarıdaki kural) ama her zaman **ikincil/doğrulayıcı** — birincil anahtar:
  parser'da `externalId`, client'ta phone/email.

### Fiyat normalize — şu an EKSİK
Bazı yerlerde fiyat **string** olarak karşılaştırılıyor (`"£28"` vs `"28.00"`). Standart: her zaman
`parseFloat(str.replace(/[£,\s]/g,''))` ile **sayıya** çevir, sayısal karşılaştır. Henüz tek helper yok
(`normalizePrice()` eklenmeli).

---

## Tekrarlayan Kalıp (PARSER_NOTES ile ortak)

- **Source/Status casing:** bkz [PARSER_NOTES.md](PARSER_NOTES.md) #2 — Firestore'da büyük harf yaz,
  sorguda `?.toLowerCase()` ile karşılaştır.
- **Servis adı mismatch:** bkz [PARSER_NOTES.md](PARSER_NOTES.md) #3.
- **Client identity:** bkz [CLAUDE.md](../salown-app/CLAUDE.md) "Client identity" — lookup sırası
  `clientManualId` → phone/email → `_aliases` → normalize phone → name-only fallback.

**Kural:** Yeni bir karşılaştırma eklerken — "bu iki değer farklı formatta gelebilir mi?" diye sor.
Cevap evetse helper'dan geçir, ikisini de. Yeni normalize helper yazma; üstteki tablodan kullan.
