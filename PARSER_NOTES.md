# PARSER_NOTES.md

Email parser'ları (Booksy, Fresha, Treatwell) geçmişte en çok sorun çıkaran alan.
Bu dosya: mimari, tekrarlayan bug kalıpları, ve "bir daha yapma" kuralları.

---

## Nasıl Çalışıyor

Salown-app IMAP ile tenant Gmail hesabını okur. Her parser kendi parse mantığını yürütür.
Deploy: `firebase deploy --only functions` — parser değişikliği için zorunlu.

```
salownManualImport (callable)
  └─ parseBooksyForTenant(db, tenantId, since, until)
  └─ parseFreshaForTenant(db, tenantId, since, until)
  └─ parseTreatwellForTenant(db, tenantId, since, until, reimport)
  └─ parseTreatwellIcalForTenant(db, tenantId, since, until)

Her parser ortak helpers kullanır:
  imapSearchAndFetch()   ← IMAP bağlantısı + fetch + seen flag
  extractTextFromRaw()   ← MIME/base64/quoted-printable decode
  hasExternalIdMulti()   ← externalId dedup kontrolü
  isTombstoned()         ← tombstone dedup kontrolü
```

---

## Dedup Sistemi — İki Katman

### Katman 1: externalId
Her booking'in `externalId` field'ı var. Format:
- Booksy: `BOOKSY-{BookingNumber}` (örn: `BOOKSY-1780000805806`)
- Fresha: `FRESHA-{ref}`
- Treatwell: `TREATWELL-T{7+digit}`

`hasExternalIdMulti(db, tenantId, externalId)` — hem doc ID hem `externalId` field'ını kontrol eder.

### Katman 2: Tombstone
`tenants/{tenantId}/parserTombstones/{key}` — kalıcı, silinemez (sadece super-admin).

İki tür tombstone:
1. **ExternalId tombstone**: `isTombstoned(db, tenantId, externalId)` — booking silinse bile yeniden yaratılmaz
2. **Slot tombstone**: `SLOT-Booksy-{date}-{time}` — aynı slot'a farklı externalId ile gelen email bloklanır (Booksy'e özgü, Jakov Zorić olayı sonrası)

**Tombstone ne zaman yazılır:**
- Başarılı import → slot tombstone (Booksy)
- `deleteBooking()` → externalId tombstone (tüm parser bookingleri)
- Bulk delete (Settings cleanup) → tombstone batch

**Tombstone silme:** Hiçbir zaman silme. Bir emailı yeniden işlemek istiyorsan Gmail'de "Okunmadı" işaretle.

---

## UNSEEN Logic  (güncellendi 2026-06-24 — seen-skip ÜÇ parser'da da tamamen kaldırıldı)

IMAP search **tarih bazlı** (`{ from, since: son 7 gün }`), UNSEEN değil → parser seen+unseen
TÜM emailları çeker, `seen` flag'ini per-message okur, işlem sonunda unseen'leri seen işaretler.

Eskiden her okunmuş (seen) non-cancel email atlanıyordu:
```js
if (seen && !isCancellation) { skipped++; continue }   // ESKİ — booking kaybına yol açtı
```
Sorun: personel email'i parser'dan (5 dk periyot) önce Gmail'de açarsa, o booking **hiç
yaratılmadan sessizce düşüyordu** (Damian Adams-Peatling 21 June olayı). Çözüm: seen-skip'i
kaldır, her yolu idempotent guard'lara bırak.

**Güncel durum (parser bazında):**

| Parser | seen-skip durumu |
|--------|------------------|
| **Booksy** | seen-skip TAMAMEN kaldırıldı (2026-06-20). new=dedup, reschedule=ordering guard, cancel=DEAD. |
| **Fresha** | seen-skip TAMAMEN kaldırıldı (2026-06-24). Booksy paritesi. |
| **Treatwell** | seen-skip TAMAMEN kaldırıldı (2026-06-24). Booksy paritesi. |

✅ **KAPANDI (2026-06-24):** Üç parser'da da `if (seen && ...)` satırı yok. seen YENİ booking
artık atlanmıyor; "Damian 21 June" / "Muhamed T2185616487" senaryosu üç platformda da kapandı.
Eskiden Fresha + Treatwell yarım fix'liydi: 2026-06-20'de sadece reschedule/cancel istisnası
eklenmiş, seen YENİ booking skip'i kalmıştı (commit `472fbec` yarım uyguladı). Bkz: Bug Kalıbı #8.

**Idempotency guard'ları (seen-skip'in yerini alan):**
- new booking → `isTombstoned` + `isTombstonedBySlot` + `hasExternalIdMulti`
- reschedule → already-applied (date/time eşleşme) skip + `lastRescheduleEmailMs` ordering guard
- cancel → DEAD-status (`CANCELLED`/`CHECKED_OUT`/...) guard

**İstisnalar:**
- Manual import (`isHistorical = true`) veya Treatwell reimport: tüm emaillar işlenir
- Bir emailı elle yeniden işlemek için: Gmail'de "Okunmadı" işaretle → parser otomatik alır

---

## extractTextFromRaw — MIME Decode (KRİTİK)

Booksy'nin `Booking #` sadece `text/plain` MIME part'ta var, HTML part'ta yok.
Bu fix yapılmadan önce: IMAP parser `Booking #` bulamıyordu → tarih/saat bazlı externalId üretiyordu → Gmail API parser ile farklı ID → duplicate.

```js
// Sıra: text/plain önce, base64 decode, quoted-printable decode
// HTML fallback: extractHtmlAsText() — son çare
```

**ASLA eski hale döndürme:** HTML part'ı direkt okuma. Her zaman `text/plain` MIME part'ı önce dene.

---

## Tekrarlayan Bug Kalıpları

### 1. ExternalId Tutarsızlığı
**Semptom:** Aynı booking iki farklı doc olarak Firestore'a yazılmış.
**Kök neden:** İki farklı parser (veya aynı parserin iki çalışması) farklı externalId üretiyor.
**Kontrol:** externalId formatı sabit mi? `BOOKSY-{BookingNumber}` her zaman bulunabiliyor mu?
**Fix:** MIME decode doğru mu? `Booking #` plain text'te var mı?

### 2. Source/Status Casing
**Semptom:** Bir feature hiç çalışmıyor gibi görünüyor (cancel gelmiyor, cleanup çalışmıyor).
**Kök neden:** `'website'` vs `'Website'`, `'booksy'` vs `'Booksy'` gibi casing uyuşmazlığı.
**Kural:** Firestore'da `source` field büyük harf: `'Booksy'`, `'Fresha'`, `'Treatwell'`, `'Website'`, `'Walk-in'`.
Sorgularda lowercase karşılaştır: `source?.toLowerCase() === 'booksy'`.

### 3. Servis Adı Mismatch
**Semptom:** Fresha/Booksy bookinglerinde "Payment due: —" veya yanlış fiyat.
**Kök neden:** Email'deki servis adı (`"Classic Short Back and Side"`) ile Firestore'daki ad (`"Classic Short Back & Sides"`) farklı.
**Fix:** `normSvc()` fuzzy normalize — `&`→`and`, trailing `s` strip. Parser match + display'de her ikisinde de kullan.
**⚠️ Not:** `normSvc` 5 yerde inline ve tutarsız (bazısı trailing `s` strip etmiyor). Tüm normalize/match
kuralları + bu tutarsızlık için tek referans: [NORMALIZATION.md](NORMALIZATION.md).

### 4. İki Parser Aynı Inbox (Jakov Zorić olayı)
**Semptom:** Whitecross'ta duplicate bookinglar.
**Kök neden:** whitecross-site parser + salown-app parser aynı Gmail'i okuyor.
**Kural:** Bir parser enable edilmeden önce diğeri disable edilmeli. Migration tablosuna bkz: [MULTI_TENANT_NOTES.md](MULTI_TENANT_NOTES.md)

### 5. Treatwell T-ref Eksikliği
**Semptom:** Treatwell bookinglar duplicate oluyor veya garip externalId'ler görünüyor.
**Kök neden:** `Date.now()` fallback unstable externalId üretiyordu.
**Fix:** T-ref yoksa email skip (`console.warn` ile). Gerçek Treatwell emaillarında daima `T{7+digit}` var.

### 6. Cancel Cross-Match
**Semptom:** Booksy cancel geldiğinde Fresha bookingini iptal ediyor (veya tam tersi).
**Kök neden:** externalId olmadan source field'ına güvenildi.
**Fix:** Cancel fallback'te prefix check zorunlu: `externalId.startsWith('BOOKSY-')`.

### 7. Zincir Reschedule — kırık eski-doc eşleşmesi (Booksy'ye özgü, 2026-06-20)
**Semptom:** A→B uygulanıyor ama B→C uygulanmıyor. Booking ikinci kez taşınmıyor.
**Kök neden:** Booksy reschedule email'i çoğu zaman orijinal booking numarasını taşımaz →
`oldExternalId` `BOOKSY-{isim}-{tarih}-{saat}` formatına düşer. Apply fallback'i bu string'i
pozisyona göre parçalayıp eski tarih/saati çıkarmaya çalışıyordu; çok-kelimeli isimlerde
("Damian Adams-Peatling") parçalama kayıyordu → canlı booking bulunamıyordu.
**Fix (A+B+C, commit 42def41):**
- **A:** Reschedule email'inden temiz `oldDate`/`oldTime` taşı, canlı booking'i `where date== / time==` ile bul (string parse YOK).
- **B:** Ordering guard — `emailDateMs <= booking.lastRescheduleEmailMs` ise atla (eski email yeniyi ezmesin).
- **C:** Reschedule'larda seen-skip kaldır (bkz #8).
**Neden Fresha/Treatwell'de YOK:** O platformların reschedule email'i stabil referans kodu taşır
(`FRESHA-{ref}`, `TREATWELL-T{...}`) → booking direkt `doc(externalId)` ile bulunur, tarih/saat
geri-üretimi gerekmez. Bu yüzden onlara sadece **B + C** uygulandı, A değil.

**🔑 Temel ilke (asla unutma):** Bir reschedule **YÖNDEN BAĞIMSIZDIR** — müşteri booking'i daha
ileri tarihe DE, daha erkene DE alabilir. "Müşteri hep ileri tarihe alır → yeni gelen tarih zaten
ileridir, öncekini beat et" varsayımı YANLIŞ. Damian 21 Jun→31 Jul (ileri) sonra 31 Jul→**1 Jul
(geri)** aldı ve bu varsayımla kurulan logic çöktü. Doğru kıstas her zaman **en yeni gelen email'in
geliş zamanı (`emailDateMs`)** — booking tarihinin yönü/büyüklüğü DEĞİL. Kod bunu uyguluyor:
within-batch seçim `emailDateMs > existing.emailDateMs`, cross-run ise B ordering guard. Yorumlarda
"higher date wins" gibi ifade görürsen düzelt — booking tarihi değil, email zamanı kastedilir.

### 8. Seen-skip Booking Kaybı (2026-06-20 Damian + 2026-06-24 Muhamed/Treatwell — KAPANDI)
**Semptom:** Yeni booking (veya reschedule) hiç sisteme düşmüyor; Firestore'da iz yok, hata da yok.
**Kök neden:** `if (seen && !isCancellation) { skip }` — personel email'i 5 dk'lık parser
periyodundan önce Gmail'de açarsa, okunmuş (seen) email atlanıyor, booking hiç yaratılmıyordu.
**Fix:** seen-skip'i kaldır, dedup/ordering guard'lara güven (idempotent). Booksy'de 2026-06-20'de
tam kaldırıldı; Fresha + Treatwell **2026-06-24'te tam kaldırıldı** (üç parser parite).
**Yarım-fix tuzağı:** 2026-06-20'de Fresha/Treatwell'e sadece `&& !isReschedule` istisnası eklenmişti
(commit `472fbec`); yorum "No seen-skip for reschedules/cancels" diyordu ama seen YENİ booking hâlâ
atlanıyordu. Yorum "halloldu" izlenimi verdiği için 4 gün gözden kaçtı → Muhamed T2185616487 düşmedi.
**Ders:** Bir fix'i çoklu parser'a uygularken üçünü de fiziksel olarak doğrula (`grep "if (seen"`);
"benzer yorum var" ≠ "aynı davranış". Düzeltme commit'i bittiğinde grep ile sıfır kalıntı teyit et.

### 9. Refactor-Orphan ReferenceError (2026-06-24, Treatwell `orderRef` — KAPANDI)
**Semptom:** Bir parser'ın TÜM yeni booking'leri sessizce düşüyor (Firestore'da iz yok). Diğer parser'lar normal çalışıyor → sorun ortak değil, o parser'a özel.
**Kök neden:** 2026-06-13 refactor'u (commit `96d6e7a`) Treatwell'de `const orderRef = refMatch[1]` tanımını sildi ama `orderRef`'i kullanan 3 yeri (`treatwellRef: orderRef`, reschedule map) bıraktı. Öksüz değişken her `set()`'te `ReferenceError: orderRef is not defined` atıyor; loop'taki try/catch yakalayıp `result.errors`'a koyuyor, booking yazılmıyor. 11 gün fark edilmedi (seen-skip ayrıca maskeliyordu).
**Teşhis:** `firebase functions:log --only salownParseEmails | grep -i treatwell` → hatayı doğrudan verdi. **Booking düşmüyorsa İLK adım: parser loglarına bak, tahmin etme.**
**Fix:** `const orderRef = refMatch[1];` `externalId`'nin altına geri eklendi (`functions/index.js:2293`).
**Ders:** Değişken tanımını silerken/yeniden adlandırırken TÜM kullanımlarını grep'le (`grep -n "orderRef" functions/index.js`). `node -c` runtime ReferenceError'ı YAKALAMAZ — sadece syntax. Çalıştırma/lint veya gerçek email testi gerekir. Aynı kalıbı diğer parser'larda da ara: bir parser'da `treatwellRef`/`orderRef`-türü öksüz değişken varsa Fresha/Booksy'de `freshaRef`/`booksyRef` benzerini grep'le.

---

## Booksy'ye Özgü Notlar

- **Subject format değişti:** Eski: `"Booking confirmed: Hafiz — 15:00"`. Yeni: `"John Smith: new booking"` (tarih yok). Tarih/saat body'den parse edilmeli.
- **Price:** `BOOKSY_DURATION_MAP[key].p` önce (config'den), yoksa regex `£([\d.]+)` fallback. Regex yeni formatta £22 (remaining) yakalıyordu — config her zaman önce.
- **Duration:** Body'deki time range'den (`15:00 - 15:25` → 25 dk), fallback map'ten.
- **HTML-only email:** `extractHtmlAsText()` fallback — bazı emaillar sadece HTML part içeriyor.

## Fresha'ya Özgü Notlar

- **Servis adı normalize:** `normSvc()` ile karşılaştır — `&`/`and` ve trailing `s` farkına dikkat.
- **Fiyat:** Email'de yoksa Firestore servis kataloğundan `svc.price` çek, parser'da yaz.
- **Cancel:** `source === 'fresha'` VEYA `externalId.startsWith('FRESHA-')`.
- **Süre (duration) — Fresha email'inde YOK** (2026-06-24 düzeltildi). Booksy saat aralığı
  (`15:00-15:25`) verir → hesaplanır; Treatwell `(40 minutes )` verir → parse edilir; **Fresha
  yalnızca başlangıç saati verir, bitiş/süre yok.** Eskiden `endTime` sabit `+30` yazılıyor ve
  `duration` field'ı HİÇ yazılmıyordu → conflict detection (`parseInt(b.duration)` truth source)
  her Fresha booking'ini 30 dk sanıyor, uzun servislerde takvim çakışması/yanlış blok oluşuyordu.
  **Çözüm:** eşleşen servisin (`svcCache`) `duration`'ı kullanılır; `duration` field'ı hem new
  booking hem reschedule yollarında YAZILIR. Eşleşme yoksa 30 fallback (eski davranış).
  - **Reschedule = sadece zaman taşıma:** mevcut `existingData.duration` korunur (30'a resetlenmez).
  - **Reschedule-create (nadir, booking yok):** `svcCache` yüklüyse oradan çözülür, yoksa 30.
  - Tüm Fresha yazma yolları artık `date/time/duration/startTime/endTime` dördünü tutarlı yazar.

## Treatwell'e Özgü Notlar

- **externalId:** `T{7+digit}` ref zorunlu. Yoksa skip.
- **iCal parser:** `since`/`until` range filter → `evt.dtStart < since || evt.dtStart >= until` olanları atla.
- **Reschedule fallback:** Booking bulunamazsa yeni booking YARATMA — tombstone bloklar zaten.
- **Reimport:** `reimport=true` → UNSEEN logic bypass, tüm emaillar yeniden işlenir.

---

## Manual Import Güvenliği

- `isHistorical = true` → UNSEEN logic kapalı
- Geçmiş tarihten re-run → missing bookinglar yaratılır, mevcut olanlar duplike edilmez (externalId + tombstone)
- `since`/`until` parametreleri tüm parserlara geçilir
- **Safe to re-run:** Her parser idempotent — aynı tarihi birden çok kez import edebilirsin.

---

## Deploy Sırası (Parser Değişikliği)

```bash
cd ~/Desktop/alex/salown-app
firebase deploy --only functions --project havuz-44f70
```

Hosting değişikliği gerekmez — parser sadece Cloud Function.

---

## Firestore Rules — parserTombstones

```
parserTombstones/{key}:
  create: tenant users
  read: tenant users
  update/delete: super-admin only (immutable after write)
```

Tombstone silinmez. Silmek istiyorsan super-admin panel'den.
