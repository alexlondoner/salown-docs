# BUSINESS_RULES.md

## Cancel & Reschedule Policy

- **Cancel**: pencere içinde (varsayılan 8 saat) ücretsiz + **deposit iade** (Stripe Connect ile ödendiyse `salownCancelByToken` otomatik refund atar). Pencere kapandıktan sonra `salownCancelByToken` cancel'ı **reddeder** (hard block, self-servis iptal yok — kod davranışı budur, "el koy" değil).
- **Reschedule**: pencere içinde (varsayılan 2 saat) izinli. Sonrası → hard block ("call us").
- ⚠️ **Pencereler tenant-configurable (2026-07-04):** `settings/settings.cancellationWindowHours` (default 8) + `rescheduleWindowHours` (default 2), owner Settings→General→"Booking policy"'den düzenler. Fonksiyonlar bu değeri okur (hardcoded 8/2 kalktı); `0` = başlangıca kadar iptal/erteleme serbest.

## Slot Generation

- Son bookable start = closing time − 15 dk (`LAST_START_GAP_MINS`)
- **Her servis için** — duration gözetmeksizin. Servisler closing time'ı geçebilir (spillover).
- `start + duration <= close` check'ini **GERİ GETIRME** — owner spillover analytics kullanıyor:
  Marketing heatmap striped cells + Spillover Summary → gelecek çalışma saati kararları.
- Bu kural hem salown-app hem whitecross-site'da geçerli — ikisini senkronda tut.
- Conflict math hâlâ spilled time'ı bloklar.

## No-Preference Barber Assignment (Her İki Site)

Müşteri belirli barber seçmediğinde:
- Eligible pool = `service.barbers[]` (non-empty ise, barber doc ID ile match; legacy name entries'e toleranslı)
- Eligible pool yoksa → tüm aktif berberler
- Least-busy pick: **ELIGIBLE pool içinden**
- No eligible barber free → slot unavailable

Race-check (submit anında): `salownGetBusySlots`'ı re-fetch et, slot hâlâ boş mu doğrula. Network error → fails-open (booking devam eder).

**No-preference race check (whitecross script.js):** `bId` ve `bNm` ikisi de boşsa, ancak service-eligible TÜM berberler blokluysa "slot dolu" sayılır. `some()` veya `barbers[0]` fallback'ine regress etme.

## Reschedule Modal — Invariant'lar

- Conflict check: `hasTimeConflict(allBookings, {..., ignoreBookingId})` save'den ÖNCE.
- Past date/time → hard block. Working hours dışı → soft confirm.
- `rescheduledBy: 'staff'`, `rescheduledAt` yazılır.
- Audit action: `'RESCHEDULE'`
- `paidAmount` ve `platformDepositAmount` reschedule'da dokunulmaz — deposit booking ile seyahat eder.
- `hasTimeConflict` caller'ları `barberValue` lowercase vermeli.
- barberId update'te: `barbers.find(b => b.name === selected).id` — display name'den fabricate etme.

## Dates & Timezone (UK)

- **ASLA** `date.toISOString().split('T')[0]` kullanma — BST'de gün kayar.
- `toDateKey()` kullan: `src/utils/timeUtils.js`
- UK DST: `isUkDst` helpers (Mart/Ekim son Pazar, 01:00 UTC boundaries).
- `month >= 4 && month <= 10` approximation'ını kullanma.

`toStartAndEnd()` (whitecross script.js): `isUkDst()` + `Date.UTC` BST offset (-1h).
`new Date(dateStr + 'T00:00:00') + setHours()` → browser-local, kullanma.

## Deposit Flow — TAMAMLANMADI (Aktif Etme)

Salown tenant deposit flow production-ready DEĞİL:
1. Stripe ödeme sonrası PENDING → CONFIRMED yapan webhook yok
2. Bu geçişte confirmation email trigger yok
3. `salownSendBookingConfirmation`: Stripe bookings için çağrılmıyor (`!stripeOn` guard)
4. BookingPage PENDING bookings'inde `expiresAt` yok → `cleanupExpiredPending` devreye girmez

**Webhook + `expiresAt` MUTLAKA önce build edilmeli — `features.stripe` / `websiteDepositsEnabled` enable'dan önce.**

Whitecross (whitecross-site) kendi tam deposit flow'una sahip — karıştırma.

## Barber Conflict — Platform Prepaid Flow

`isFullyPaidByPlatform = isPlatformBooking && (configuredPmt === 'prepaid' || booking.paymentType === 'FULL') && alreadyPaid > 0`

- True ise: SummaryPanel "Prepaid by {source} ✓" gösterir. PaymentStep method grid'i atlar.
- `depositAmount` fallback chain: `platformDepositAmount || paidAmount || priceFromBooking`
  (`priceFromBooking` iCal import'lar için — paidAmount yok)

## Actor Tracking

- `cancelledBy: 'customer'|'staff'`
- `rescheduledBy: 'customer'|'staff'`, `rescheduledVia: 'email-link'` (customer path)
- Her iki callable `auditLogs` koleksiyonuna yazar:
  `BOOKING_CANCELLED_BY_CUSTOMER` / `BOOKING_RESCHEDULED_BY_CUSTOMER`
