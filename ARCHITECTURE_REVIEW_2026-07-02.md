# ARCHITECTURE REVIEW — 2026-07-02

> Dış-göz mimari değerlendirmesi. **İki kaynak birleşimi:**
> - **GPT (SaaS pattern lensi):** mimari şekli, olgunluk teşhisi, orta-vadeli borç önerileri.
> - **Claude (repo lensi):** GPT'nin çağrılarını gerçek koda karşı doğrulama + yeniden sıralama.
>
> **Neden ikisi birlikte:** GPT SaaS pattern'lerinden akıl yürütür (dosyaları görmez); Claude
> `firestore.rules` / `functions/index.js` / `Reports.jsx`'i okur. Ayrıştıkları yerde **kod kazanır** —
> bu doküman farkın *nerede* olduğunu kaydeder.
>
> Durum kaynağı değildir → aksiyona dönen maddeler [ROADMAP.md](ROADMAP.md)'de yaşar. Bu dosya *teşhis*.

---

## 🟢 Güçlü taraflar (GPT — Claude teyit etti)

| # | Bulgu | Claude notu (koddan) |
|---|-------|----------------------|
| 1 | **Multi-tenant temeli doğru** — `tenants/{tenantId}/...` | Sadece path değil, **claim-based**: `tenantId` Firebase custom claim'de (`AuthContext.jsx`, `firestore.rules:18`). App-state'te değil JWT'de olması migration'ı da kurtarıyor. En zor iş başta çözülmüş. |
| 2 | **Booking modeli gerçek dünyadan** — walk-in quirks, `barberId` tutarsızlığı, DST, status normalize, parser tombstones | Teyit. Bunlar "gerçek kullanıcı sistemi kırdı → düzeltildi" izi = olgunluk. `FIRESTORE_SCHEMA.md`'de belgeli. |
| 3 | **Notification 3 kanal** — Email · Push · Telegram | Teyit: FCM staff app'te gerçek (`StaffApp.jsx`, `fcmTokens/`), Telegram `settings/integrations`. Sonradan eklemesi zor katman. |
| 4 | **Public booking güvenliği doğru** — server-side | Teyit: `salownCancelByToken` / `salownRescheduleByToken` onCall (`index.js:1315,1384`), token'lı email link, unauthenticated Firestore write yok. |
| 5 | **IMAP parser** (Booksy/Fresha/Treatwell tek ekran) = differentiator | Teyit **ama uyarı var** → aşağıda 🔴-2 (güç ve kırılganlık aynı yerde). |
| 6 | **Ask salOWN** — tek DB'de booking+finance+marketing+clients+loyalty → AI verimli | Teyit: `askAI` onCall, **Anthropic Claude Haiku 4.5** (`index.js:3362`, secret `ANTHROPIC_API_KEY`). Tek AI dokunuş noktası. |

---

## 🟡 Orta-vadeli borçlar (GPT — Claude teyit + nüans)

1. **`functions/index.js` 4541 satır → böl.** GPT önerisi: `bookings/ marketing/ notifications/ parsers/ stripe/ ai/ staff/ clients/`.
   **Claude nüansı:** v2 functions olduğu için refactor **düşük riskli/mekanik** (her export bağımsız redeploy). Korkulacak borç değil — **ilk ödenecek** borç, çünkü ucuz ve okunabilirliği hemen açar.
2. **`settings/emailConfig` app-password düz metin → Secret Manager.** Zaten `T-b` olarak takipte. Ölçekte önem kazanır.
3. **Tek Firebase project** (`havuz-44f70`). Şu an sorun değil; ileride `dev/staging/prod` ayrımı istenebilir.
4. **Canonical booking model borcu** (`barberId` id-vs-isim, `endTime` string-vs-Timestamp, walk-in'de `date` yok). Biliniyor olması iyi; her yeni query'de tuzak.

---

## 🔴 Yeniden sıralama — GPT ile Claude'un AYRIŞTIĞI yer

> Bu bölüm dokümanın asıl değeri: dışarıdan büyük görünen ≠ içeride yakan.

### GPT'nin 🔴'sı: "Finance hardcoded Whitecross = en büyük teknik risk"
**Claude: 🔴 değil, 🟡.** Finance izole — tek dosya (`Finance.jsx` 1905), tek tenant, veri bütünlüğü tehdidi yok. "İkinci salon finance ister" → **feature-rebuild**, felaket değil. Contained. Dışarıdan satır sayısı büyük duruyor; içeride sınırlı.

### Claude'un gerçek 🔴'ları (GPT kuralları/kodu okumadığı için göremedi):

- **🔴-1 · `allow read: if true` yüzeyi + world-readable tenant root.**
  Public booking siteleri okusun diye çoğu koleksiyon herkese açık okunuyor (`firestore.rules`), `tenants/{id}` root doc dünyaya açık. 10 salonda görünmez; **1000 salonda PII enumerate + Firestore read-cost bombası**. Ve 1000 tenant bu davranışa güvenince geri sarması zor → **sistemik, geri alması zor.** (`prescale_hardening` Tier 1.)

- **🔴-2 · Parser kırılganlığı differentiator'ın *aynı yerinde*.**
  API entegrasyonu değil — salon Gmail'ini IMAP+regex ile okuyan cron (`salownParseEmails`). Booksy/Fresha email formatını değiştirirse parser **sessizce** kırılır (exception değil, sadece 0 import). En güçlü özellik, en sessiz başarısızlık moduna sahip.
  → **En yüksek ROI'li 20 satır:** "beklenen sayıdan az import → alarm" canary'si.

### Zamanlama düzeltmesi: "10 salon sorunsuz" — bir istisna
**`delete = super-admin only`** (yalnız `aerulas@`, `firestore.rules` tüm koleksiyonlarda `allow delete: if isSuperAdmin()`). Güvenlik içgüdüsü doğru ama bu **1000'de değil ~3. salonda** operasyonel darboğaz: her yanlış-booking silme talebi tek kişiye düşer. Bus-factor + operasyon riski burada birleşir.

---

## 📈 Ölçek okuması (GPT tablosu + Claude eklemesi)

| Ölçek | GPT | Claude eklemesi |
|-------|-----|-----------------|
| **10 salon** | Sorunsuz | ⚠️ İstisna: delete-bottleneck ~3. salonda vurur (yukarı). |
| **100 salon** | Biraz optimizasyon | **Reporting'i işaretle:** `Reports.jsx` client-side aggregation (Firestore→JS `reduce`). 1000'i beklemeden, ~100'de tarayıcıda çöker → cloud function / pre-aggregated `stats/` doc'a taşı. |
| **1000 salon** | parser scheduling · Firestore cost · index · cold start · reporting aggregation | Teyit + 🔴-1 (read:true cost) burada patlar. |

---

## ✅ En ucuz ilk hamleler (öncelik sırası)

1. **Parser canary** — beklenenden az import → alarm. (~20 satır, en yüksek ROI, differentiator'ı korur.)
2. **`functions/index.js` split** — mekanik, düşük risk, okunabilirlik açar.
3. **Reporting pre-aggregation planı** — 100 salon gelmeden `stats/` doc tasarımı.
4. **🔴-1 read:true daraltma** — Pre-Scale Hardening Gate Tier 1 (tenant #4 öncesi).

---

## 🧭 Çalışma bölüşümü (bu review'ın çıkardığı meta-ders)

- **GPT** → SaaS yönü / pattern / "ne inşa etmeli".
- **Founder (Alex)** → mimariyi okur, kararı verir.
- **Claude** → repo'ya karşı doğrular + yazar + tasarlar.
- **Kural:** GPT'ye yön sor, Claude'a "bu kodda gerçekten öyle mi" diye doğrulat. Ayrışırlarsa **kod kazanır.**
