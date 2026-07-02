# FIRESTORE_SCHEMA.md

## Genel Yapı

```
tenants/
  {tenantId}/
    settings/settings    ← business config, hours, loyalty, deposit rules
    settings/hours       ← mirror of hours (quick reads)
    settings/emailConfig ← gmail + app password for parsers
    settings/integrations ← treatwellIcalUrl
    barbers/             ← per-barber working days + hours
    bookings/            ← all bookings
    services/
    products/
    clients/
    staff/               ← staff accounts + roles
    emailOptOuts/        ← GDPR: opt-out records for unknown clients
    auditLogs/           ← booking audit trail
    parserTombstones/    ← duplikasyon engeli (örn: SLOT-Booksy-{date}-{time})
```

## Booking Model — Kritik Quirk'ler

- Walk-in bookings (`createWalkIn`): NO `date` field — sadece `startTime` (Firestore Timestamp).
  **Hiçbir zaman `date` field'a göre query etme** — `startTime` range kullan.

- `barberId` tutarsız:
  - Walk-ins: lowercase barber NAME
  - Online (BookingPage): barber doc id + `barberName` field
  - Her zaman hem id hem name'e (lowercased) karşı match et

- `booking.duration` (minutes): online bookings için truth source.
  `parseInt(booking.duration)` — service lookup'tan önce kullan (variations break service list)

- `endTime` shape farklı:
  - Dashboard: label string ("2:00 PM")
  - Bookings.jsx / Clients.jsx: raw Timestamp
  - `conflictUtils.getExistingRangeMinutes` ikisini de handle eder — bunu koru

- `bookingId`: `WCB-{ts}-{rand}` (walk-ins), `SALE-`, `BLOCKED-` prefix'leri.
  **Firestore doc id DEĞİLDİR.** Email cancel/reschedule link'leri bu field'ı taşır.

- Status normalize: `normalizeBookingStatus` via. Blocking: `CONFIRMED`, `PENDING`, `UNPAID`, `BLOCKED`.
  Non-blocking: `CANCELLED`, `NO_SHOW`, `DELETED`, `CHECKED_OUT`, `COMPLETED`.
  ⚠️ Import'larda lowercase 'checked_out' gelebilir — load'da normalize et.

## Client Identity — Kritik Kurallar

- Booking → client bağlantısı: `clientManualId` (Firestore doc ID) → `clientPhone`/`clientEmail` exact match → `_aliases` → normalized phone (son 10 digit).
- **İsim ile hiçbir zaman match etme** — phone veya email varsa.

- `_aliases`: client doc'ta string array. Telefon/email değiştirildiğinde ESKİ değer `_aliases`'a `arrayUnion` ile eklenmeli.

- Lookup order (`checkoutBooking`, `getClientLoyaltyPoints`):
  1. `clientManualId` direct doc read
  2. Exact phone query → exact email query
  3. Full scan: aliases + normalized phone
  4. Name-only fallback: YALNIZCA booking'de phone VE email yoksa
  5. Hepsi başarısız olursa yeni client doc oluştur

## Money & Loyalty

- `loyalty.cashbackPct` tenant-configurable — `settings.loyalty.cashbackPct`
- `loyaltyRedeemedValue` (£) booking'e yazılır checkout'ta
- `bookingNetWithoutTip`: önce `loyaltyRedeemedValue`, fallback `points / 20` (legacy, dokunma)
- `paidAmount`: DEPOSIT bookings için deposit tutarı. Edit/reschedule'da SIFIRLANMAZ.
- CHECKED_OUT booking'lerde `paidAmount` = full previous total — re-checkout'ta deposit olarak muamele etme, `platformDepositAmount` kullan.
- `pp()` negatif değerleri korur (refunds). Minus sign silme.

## parserTombstones

`parseBooksyForTenant`: her başarılı import'ta `parserTombstones/SLOT-Booksy-{date}-{time}` yazar.
Aynı booking için iki farklı email → farklı externalId → bu tombstone duplikasyonu engeller.
