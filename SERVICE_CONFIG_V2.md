# SERVICE_CONFIG_V2.md — Detailed Service Configuration (3-platform superset)

> Goal: make the salOWN service editor the **superset** of Booksy + Fresha + Treatwell.
> "Whichever platform the user uses, salOWN should match those settings" (channelProfiles).
> Related: `BUSY_SLOT_V2.md` (scheduling engine), `MANIFESTO.md` (aggregator).
> **Status:** DESIGN. The scheduling-engine part is partially coded (processing); the rest is pending.

---

## 0.5 ⭐ Decision (owner, 2026-06-24): SOON fields = source-connection-driven
The Treatment type + SOON sections (Capacity/Parallel, Tax, Booking interval, Padding/cleanup)
**won't be filled in manually** — they'll be filled/matched **intelligently based on the tenant's
connected source** (Booksy/Fresha/Treatwell). That is, these fields will be derived from the
platform settings via channelProfiles; the owner won't enter them one by one. For now they sit
in the editor as "SOON" stubs. Treatment type also saves right now, but it will gain meaning once
it's wired to parser/marketplace matching.

## 0. ⭐ Architectural decision: shared or separate? → HYBRID

The core of the three platforms is the **same logic** (segment + price + team + buffer + capacity);
the differences are naming + a few platform-specific fields. Decision:

**ONE shared base model + a thin per-channel override layer (channelProfiles).**
- Not fully shared: price varies by platform (Treatwell off-peak −20%), and a service can be open
  on one channel and closed on another.
- Not fully separate (3 models): the physical reality of the chair is ONE; 3 models = 3× maintenance
  + sync.

| Field | Layer |
|---|---|
| Segments (timing), duration, cleanup/padding, treatment type, category, description, team, parallel clients, booking interval | 🔵 **Shared base** (physical/single truth) |
| Price, sale/off-peak discount, online-booking on/off, (later processing override) | 🟢 **Per-channel override** (legitimately varies) |

The owner defines a service once; if needed, adds per-channel price/visibility overrides.
`service.channelProfiles[platform]` holds only the **delta**; if missing, falls back to base.

### Platform-specific fields (meaningful only on the relevant channel)
- **Treatwell:** off-peak discount, Sale price, Fine print, Distribution, Cleanup time
- **Booksy:** No-show protection, Combo services, Mobile/Virtual service, Padding rule, Tax rate
- **Fresha:** Resources, Forms, Commissions, Portfolio, segment types (incl. blocked)

---

## 1. Three platforms — field comparison

| Field | Booksy | Fresha | Treatwell | salOWN (superset) |
|---|---|---|---|---|
| Service name | ✓ | ✓ | ✓ | ✓ (exists) |
| Menu category | ✓ | ✓ (reflected online) | ✓ | ✓ (exists) |
| Treatment type (marketplace matching) | – | ✓ | ✓ | **new** |
| Description | ✓ | ✓ (+AI Enhance) | ✓ | ✓ (exists) |
| Price type (Fixed / From / Free) | ✓ | ✓ | ✓ | partial (Fixed exists) |
| Price | ✓ | ✓ | ✓ | ✓ (exists) |
| **Duration (segmented)** | fixed fields | **segment array** | duration | **segment array** (below) |
| Variations / variants | ✓ | ✓ (Add variant) | ✓ | ✓ (exists) |
| Deposit | ✓ | ✓ | ✓ | ✓ (exists) |
| **Booking interval** (per service) | ✓ (15min) | – | – | **new** (global exists) |
| **Padding time** | ✓ | (via blocked) | – | **new** |
| **Parallel clients** (capacity) | ✓ | (resources) | side-by-side block | **new — separate engine** |
| Online booking on/off | ✓ (self-booking) | ✓ | ✓ | partial (`active`) |
| Team members (who does it) | ✓ | ✓ | ✓ | ✓ (`barbers[]`) |
| Resources (room/chair) | – | ✓ | – | **new** |
| Service add-ons | ✓ | ✓ | ✓ | partial (addOns) |
| Forms / Commissions / Portfolio | – | ✓ | – | **new (low priority)** |
| Tax rate | ✓ | (account level) | – | **new** |
| Mobile / Virtual service | ✓ | – | – | **new (low priority)** |

---

## 2. ⭐ Scheduling model: segment array (3 types)

Fresha's "Add extra time" menu clarifies the model — **three segment types**:

| Type | Barber state | In customer's duration | **salOWN busy?** | Source |
|---|---|---|---|---|
| **service** | busy | visible | ✅ busy | Fresha "Servicing / Extra servicing" |
| **processing** | **free (fillable)** | visible | ❌ **free** | Fresha "Processing", Booksy "during" |
| **blocked** | busy | **hidden** | ✅ busy | Fresha "Blocked", Booksy "padding/after" |

**Storage:**
```
service.segments = [
  { type: 'service',    duration: 20 },
  { type: 'processing', duration: 30 },   // ← empty window, another customer fits in
  { type: 'service',    duration: 20 },
]
// total duration = sum of segments
```

**Busy intervals** = the union of consecutive `service`+`blocked` runs; `processing` = gap.
This is the generalized form of `getBusyIntervals` from `BUSY_SLOT_V2`.

**Duration shown to the customer** = `service + processing` (excluding blocked).

### Relation to the current code
The currently coded model `processing: {activeBefore, processing, activeAfter}` =
the special case `[service:activeBefore, processing, service:activeAfter]`. In v2 the storage
moves to **`segments[]`**; `getBusyIntervals` + `salownIcalFeed` are generalized to N segments
(busy = service∪blocked). Backward compatibility: the old `processing` object is read and mapped
to segments. All of it is still **flag-gated + test-first**.

---

## 3. Parallel clients (capacity) — SEPARATE engine concept

Booksy "Parallel Clients" and Treatwell's side-by-side block visual (Image 5) are a different
thing: **full service to N customers at the same time** (NOT a processing-gap). This requires a
**capacity counter** per interval (concurrent bookings per barber/resource ≤ N). It's a separate
extension of the engine; not to be conflated with the processing-gap. Separate phase, separate test.

---

## 4. Treatwell side-by-side block (Image 5)
When a booking is taken, a grey block in the adjacent column = the slot being blocked side by side.
From salOWN's perspective this is how the busy blocks of `salownIcalFeed` appear in Treatwell.
With processing: active segments are grey (full), the processing window stays open.

---

## 5. Editor design (Fresha-style sections)
The service editor is split into sections (instead of the current single panel):
1. **Basic** — name, menu category, treatment type, description
2. **Pricing & duration** — price type (Fixed/From/Free), price, **segment editor** (add service/processing/blocked), variants, deposit
3. **Online booking** — self-booking on/off, booking interval, padding
4. **Capacity** — parallel clients (capacity)
5. **Team & resources** — who does it (barbers), room/chair
6. **Add-ons / Tax** — add-on services, tax rate

Fields that affect the engine: **segments, padding, parallel-clients, booking-interval** →
each flag-gated + test-first. The others (description, treatment type, tax) are pure data/UI.

---

## 6. Phases
| Phase | Content | Engine? |
|---|---|---|
| **SC-1** ✅ CODED | `segments[]` model + segment editor (service/processing/blocked) — processing migrated. Engine/iCal/render N-segment, 24/24 tests, flag OFF | ✅ getBusyIntervals N-segment |
| **SC-2** partial ✅ | Price type (Fixed/From/Free) + treatment type ADDED. Tax = sensitive (Finance), separate | ❌ data/UI |
| **SC-3** ⏳ | Booking interval (per service). **Padding/cleanup = ALREADY solved via segment `blocked`** | ✅ slot gen — sensitive |
| **SC-4** ⏳ | Parallel clients (capacity counter) — separate engine, sensitive | ✅ separate engine |
| **SC-5** | Resources (room/chair), forms, commissions, portfolio | ✅/❌ large scope |

**Order:** SC-1 first (the scheduling superset, absorbs the existing processing), then the UI/data
phases. Engine phases always with characterization+parity tests.
