# ONB-GUIDED-SETUP — onboarding review and proposed flow (review only, no code)

2026-11-15. ROADMAP row: `ONB-GUIDED-SETUP`. Status `PLANNED`: owner decisions taken 2026-11-15 (§7). The logo (D5) waits for a screenshot and blocks nothing else.
Nothing was implemented, deployed or written to production for this review.

**Sources read**
- **Live Admin:** `a8544b9fa43dc70e`, source **`494c7209`** (`release/booksy-grid-duration-on-live-f9f1e5a8`). `OnboardingWizard.tsx`, `AppRouter.tsx` and `Services.tsx` are byte-identical on main `46d97d6f`. `Signup.tsx` differs only in the business-type list (main uses the catalog in `src/utils/businessTypes.ts`, which is not live).
- **Live provisionTenant:** `provisiontenant-00141-vuw`, source `1be6dd54`.
- **Line references:** `file:line` points at those sources unless it says "main".

**Not in scope** (these do not follow from this request):
- removing the demo-request path;
- adding a signup link to the landing page;
- any production data change;
- deleting test tenants.

## 1. Current flow (measured in code)

**Signup → panel**
1. `/signup` (`src/pages/Signup.tsx`) takes these fields: salon name, business type (`<select>`, `:370-377`), city, owner name, address, phone, email and password.
2. It creates the Auth user, then calls `provisionTenant` (`:235-238`) and runs `navigate('/app')` (`:244`).
3. `provisionTenant` (`functions/src/index.ts:264-296`) writes `businessType` **exactly as sent**, plus `onboardingComplete: false` and `profileStatus: 'draft'`.
4. It also writes an owner barber (`index.ts:334-351`). That barber has `workingDays` Mon–Sat and **`dayHours`** Mon–Fri 09–18, Sat 09–17, Sun closed.
5. It also writes the staff doc, claims, slot, audit row and welcome mail. Since `R-2026-11-15-A`, the welcome mail already links `/book/<tenantId>`.

**`/app` gate** (`AppRouter.tsx:115-129, 183`)
- The app reads `tenants/{id}`.
- If `onboardingComplete === true`, the panel opens.
- **In every other case, including a failed read (`catch` → `'onboarding'`, `:123-126`)**, the full-screen `OnboardingWizard` replaces the whole panel. There is no route around it.

**Wizard** (`OnboardingWizard.tsx`, 4 steps, `:700-727`)

| # | Step | Writes | Can it be skipped? |
|---|---|---|---|
| 1 | Services | `services/*` (`:270-293`) | **No.** "Add at least one service to continue." (`:245-248`) |
| 2 | Working hours | `settings/hours` (`:419-422`) | No (Continue saves the defaults) |
| 3 | Platforms (Treatwell URL, iCal, **Gmail address + Gmail App Password** for parsers) | root, iCal doc, `settings/emailConfig` (`:523-535`) | Yes, "Skip for now" (`:613`) |
| 4 | "Your booking link" + "Go to my dashboard" | `onboardingComplete: true` (`:645-647`) | Last step |

## 2. Findings (with evidence)

**F1. The business type defaults to Barber, and the wizard ignores it.**
- `Signup.tsx:191` pre-selects `businessType: 'Barber'`, so a user who never touches the select is stored as Barber.
- The server accepts the value as-is (`index.ts:264, 296`). `self-signup/barber@1` is only the policy name; it does not force the type.
- Whether the test signup `zazakihairo` (stored `Barber`) was chosen or left at the default **cannot be told from the data**. The owner does not remember choosing a type (2026-11-15), which fits the pre-selected default but does not prove it. The fix (D1: required, no default) does not depend on the answer.
- The wizard never reads `businessType`. Its placeholders are fixed: "Haircut" (`:340`). Services shows "e.g. Skin Fade Cut" (`Services.tsx:1022`).
- Main already has a per-type person noun: `personLabel` in `src/utils/businessTypes.ts` (Barber/Stylist/Technician/Therapist/Artist/Professional). It is not live.

**F2. Adding a service is a hard gate in front of the whole panel** (`:245-248` together with `AppRouter.tsx:183`).
- The owner cannot look around the panel first.
- A transient read error on the root also drops an already onboarded tenant into the wizard (`:123-126`).

**F3. Progress is not saved, and re-entry can create duplicate services.**
- `step` lives only in memory (`useState(0)`, `:700`).
- The wizard reads nothing back: no `getDocs` or `getDoc` exists in the file.
- Closing the tab after step 1 means the next visit starts again at step 1 with an empty list, and the owner has to add a service again. The rows saved earlier stay, so the services are duplicated. `savedKeys` only protects retries within one visit.

**F4. The "Working hours" step does not change bookable times.**
- Booking availability is per staff member: `getEffectiveStaffShift` uses the salon's `settings/hours` **only when the staffer has no `dayHours` of their own** (`utils/staffAvailability.ts:140, 183`).
- Signup gives the owner barber `dayHours` (`index.ts:343`), so the hours the owner enters in step 2 do not reach the booking page. The signup defaults decide the slots.
- This is derived from code; it has not been observed on a live booking.

**F5. Nothing gates "open for online booking" today.**
- `/book/<id>` is public from the moment the tenant is created.
- With 0 services it shows "no services" (`BookingPage.tsx:1912`). With one service it is bookable at the owner's signup default hours, whether or not the wizard finished.
- The server gate in `salownCreateBooking` checks only tenant lifecycle capabilities (`createBooking.ts:745-748`). Step 4 "Your booking link" opens nothing.

**F6. Step 3 asks for a Gmail App Password during first-run** (`:535, :588`). This is a credential request in a "get started" flow, before the owner has seen the product.

**F7. The logo colour differs between surfaces.**
- The web `Logo` component paints the "OWN" chip **`#534AB7`** and "sal" `#f0f0f0` or `#0a0a0a` (`Logo.tsx:26, 30`).
- The brand asset `public/logo-primary.svg` uses chip **`#5546e6`** and text `#16142e`. It also writes lower-case **"own"** in font "PJS" (the brand rule says salOWN).
- The Staff / salOWN Pro app uses `--brand: #5546e6` (`src/staff/staff.css:6`, `LoginScreen.tsx:72`).
- The docs disagree too: `SYSTEM_ARCHITECTURE.md:107` says `#534AB7`, `SYSTEM_MAP.html:4` says `#5546e6`.
- Which purple is the brand colour, and which screen the owner means, is **not established**. A screenshot is requested (§7 D5).

**F8. The mobile app has no signup entry.**
- The native shell is Capacitor 8, **iOS only** (`capacitor.config.ts:10-12`: `com.salown.staff`, "salOWN Professionals", embedded bundle, no `server.url`). It loads the Staff app.
- `src/staff/LoginScreen.tsx` offers email/password only. It has no "create account" or `/signup` link, and Google/Apple are hidden in native.
- There are no universal links or `apple-app-site-association`.
- A self-signed-up owner should be able to sign in to it (claims plus a matching owner barber email). This is inferred, not tested.
- **`STAFF-NATIVE-D1-P0` (status working) locks** `LoginScreen.tsx`, `StaffApp.tsx`, `StaffRouter.tsx`, `capacitor.config.ts`, `ios/`, `package.json` and more. That work must not be touched here.

## 3. The principle: two separate conditions

| Condition | Meaning | Proposed rule |
|---|---|---|
| **Panel access** | The owner can use and explore salOWN | Signed-in owner with a tenant claim. Never blocked by missing setup. |
| **Accepting online bookings** | Customers can book on `/book/<id>` | ≥ 1 active bookable service **and** ≥ 1 active staff member with confirmed hours **and** the owner turned online booking on. Enforced **server-side** in `salownCreateBooking`, next to the existing capability gate. The booking page shows a neutral "not taking online bookings yet" state. |

Legacy and onboarded tenants must keep working unchanged. The new gate applies only to tenants whose setup record says they are not yet published.

## 4. Proposed screen flow

**Signup**
- Unchanged fields, but the business type has **no pre-selection**: a required "Choose your business type".
- Show the type as cards with icons (Barber, Hair salon, Nails, Beauty, Lash & brow, Spa/Massage, Tattoo, Mobile, Other).

**A. Welcome (one screen)**
- "Welcome to salOWN, {name}. Let's get {salon} ready for customers. It takes about 5 minutes and you can stop at any point."
- Three cards: Services · Team & hours · Booking page.
- Buttons: **Start setup** / **Explore the dashboard first**.

**B. Setup checklist** (persistent, at `/app/setup` and as a card on Home)
- Each step shows: done / not done, why it matters, and **Add now** or **Do this later**.
- Progress is saved per step on the tenant, e.g. `setup.{services,team,hours,bookingPage}` with timestamps.
- Steps:
  1. **Services.** Starter suggestions per business type, never auto-created; the owner ticks and edits prices.
  2. **Your team & hours.** The owner's own hours edit the **owner's staff `dayHours`**, which fixes F4. "Add team members" is optional.
  3. **Booking page.** Preview, then a switch for **Accept online bookings**. It is disabled until the conditions in §3 are met, and says which one is missing.
  4. **Optional extras:** connect Treatwell/Booksy (moved out of first-run; F6), profile photos, deposit/payments.
- "Do this later" goes to the dashboard. A slim banner "Setup 1 of 3 · Continue" stays until the booking page is live or dismissed.

**Copy by business type.** Use `personLabel` plus a small per-type example set:

| Type | Person (en / tr) | Service examples (en) | Placeholder |
|---|---|---|---|
| Barber | Barber / Berber | Haircut · Skin fade · Beard trim | "e.g. Skin fade" |
| Hairdresser | Stylist / Stilist | Cut & blow-dry · Full colour · Balayage | "e.g. Cut & blow-dry" |
| Nail Studio | Technician / Teknisyen | Gel manicure · Acrylic full set · Pedicure | "e.g. Gel manicure" |
| Lash & Brow | Technician / Teknisyen | Classic lash set · Brow lamination · Tint | "e.g. Brow lamination" |
| Beauty Clinic / Spa / Massage | Therapist / Terapist | Facial · 60-min massage · Waxing | "e.g. 60-min massage" |
| Tattoo Artist | Artist / Sanatçı | Consultation · Small tattoo (1 h) · Session (3 h) | "e.g. Consultation" |
| Other | Professional / Uzman | — | "e.g. Consultation" |

Sample strings (en; tr through the dictionaries):
- "Add the {services} your clients book most. You can add the rest later."
- "Set your own working hours. Clients can only book times when a {person} is working."
- "Your booking page isn't taking bookings yet. Add at least one service and confirm your hours, then switch it on."
- Buttons: **Add now** · **Do this later**.

**External reference** (official sources, checked 2026-11-15; a pattern to learn from, not a template to copy).

*Fresha* ([help article 482](https://www.fresha.com/help-center/knowledge-base/personal-account/482-create-a-fresha-account-as-a-business-owner), [266](https://www.fresha.com/help-center/knowledge-base/online-presence/266-create-your-online-profile)):
- Signup asks for primary service type, team size and location type.
- The online profile is a separate wizard with "Save and exit". It goes live only on Publish, after hours, photos, description, terms and card details.

*Booksy:*
- The official getting-started page groups setup into Profile / Calendar / Staff & services / Getting booked / Payments ([source](https://booksy.com/biz/en-us/lp/getting-started-on-booksy)).
- Per-staff and per-service online-booking toggles ([blog, 2023-01-11](https://biz.booksy.com/blog/get-discovered-on-booksy-in-6-simple-steps)).
- Category-seeded default services appear only in a help-centre search summary; the page itself could not be opened (HTTP 403). Not verified.

*Neither platform documents* a setup-progress checklist or per-category wording.

## 5. Skippable steps vs. conditions for online booking

| Item | Skip in setup? | Effect if skipped | Needed to accept online bookings? |
|---|---|---|---|
| Services | Yes | Booking page shows "not taking online bookings yet" | **Yes**, ≥ 1 active, bookable |
| Owner / staff hours | Yes (signup defaults stay) | Calendar uses the defaults | **Yes**, confirmed by the owner (not just the defaults) |
| Team members | Yes | The owner is the only bookable person | No (the owner counts) |
| Salon hours (`settings/hours`) | Yes | Fallback only | No |
| Platforms / parsers / Gmail | Yes (moved out of first-run) | No parser import | No |
| Online profile `/s/` | Yes | Stays `draft` (separate flow) | No |
| Deposits / payments | Yes | Pay at venue | No |

**Leaving part-way and coming back:**
- Every step saves on its own action. The checklist reads the real data back (services count, owner hours, `setup.*`), so returning never repeats or duplicates a step (fixes F3).
- `onboardingComplete` stops being a gate. It becomes "welcome seen".
- A failed root read shows a retry state, not the wizard (F2).

## 6. Mobile (salOWN Pro) signup plan

| Phase | What | Depends on |
|---|---|---|
| M0 | Decide whether new owners start on mobile at all, or whether the app shows **"New to salOWN? Create your business at salown.com/signup"** (opens the browser) | Owner decision D4 |
| M1 | That link/button on `LoginScreen.tsx`. After web signup the owner signs in to the app with the same email/password. | **`STAFF-NATIVE-D1-P0` must hand over `LoginScreen.tsx`** (claim); a new App Store build (embedded bundle, no OTA) |
| M2 | A "salon not set up yet" screen in the app: the checklist read-only, with "Continue setup" opening `/app/setup` on the web | Phase W2 (setup record) |
| M3 | Native in-app signup calling the same `provisionTenant` (same fields, same server rules, no second provisioning path) plus universal links (`apple-app-site-association` on salown.com) | Apple enrolment, D1 claim release, privacy/terms URLs; Android does not exist yet |

## 7. Owner decisions (2026-11-15)

| # | Decision |
|---|---|
| D1 | The business type is **required, with no pre-selection**. (The owner not recalling a choice proves nothing; the pre-selected default is the defect.) |
| D2 | Setup is skippable; **dashboard access is always open**. |
| D3 | Online bookings open only by the **owner's explicit decision**, and only once the required information is complete (§3). |
| D4 | The Gmail/parser connection moves out of first-run into Settings. |
| D5 | Logo: clarify with a screenshot. It **does not block** the other work. |
| D6 | Services are **suggested, never auto-created**. |
| D7 | Mobile signup link = a **separate native work item** (§6), after the `STAFF-NATIVE-D1-P0` hand-over. |

## 8. Phased scope and RELEASE ORDER (binding)

**Order rule (owner, 2026-11-15).** "Do this later" must **never** reach production before the server check that stops a new salon with incomplete setup from taking online bookings.

Today a new salon becomes bookable as soon as one service exists, at the signup default hours (F4/F5). Only the hard services gate in the wizard keeps owners walking through hours. Releasing "skip" first would let new salons start taking bookings unconfigured.

**Order** (refined in §8.2 R4):
1. W1
2. **W3a (guard) → W3b (marker writers), both live and verified**
3. W2 (skippable checklist)
4. W4
5. W5 whenever D5 is settled

M-phases are separate.

| Phase | Scope | Surface | May ship only after |
|---|---|---|---|
| W1 | Signup type required (no default); wizard + services copy by type (`personLabel` + example table); retry state instead of the wizard on a read error | Admin hosting | — |
| W3 | "Accept online bookings": server gate in `salownCreateBooking` (public path only) + neutral booking-page state + the owner's switch (disabled until §3 holds) | Functions (live-lineage kit) + Admin hosting | W1 |
| W2 | Setup record `setup.*` + checklist page + Home banner; "Do this later"; panel never gated; hours step writes the owner's `dayHours` | Admin hosting (+ rules for the new fields) | **W3 LIVE_VERIFIED** |
| W4 | Platforms/Gmail out of first-run into Settings | Admin hosting | W2 |
| W5 | Logo / brand token after D5 | Admin (+ Staff if needed) | D5 |
| M1–M3 | §6 | Staff/native | `STAFF-NATIVE-D1-P0` hand-over |

### 8.1 Compatibility rule for existing salons (must be explicit and tested)

The claim "existing salons are unaffected" is a rule with tests, not an assumption.

**Rule C1.** The public booking gate applies **only** to a tenant whose root carries the new marker:
- `onlineBooking.state` is `'setup'`, or `'paused'` by the owner;
- written by `provisionTenant` for **new** self-signups once W3 is live.

Every tenant **without** the marker is treated as **open**. That covers every tenant that exists today (whitecross, herohairs, legacy, approved/invited salons, test tenants). No migration, backfill or write is made to existing tenants.

**Rule C2.**
- `'open'` is set only by an owner action: callable or rules-checked write, recording actor and time.
- The server re-checks the §3 conditions at the moment of opening.
- After opening, removing the last service does not silently flip the state. The booking page simply has nothing to book, as today.

**Rule C3.** The privileged paths are untouched by this gate:
- Admin / Staff-App bookings and walk-ins (`priv`), and the existing lifecycle capabilities;
- reschedule / cancel by token for existing bookings.

**Rule C4.** The refusal is neutral and machine-readable: `TENANT_NOT_ACCEPTING_BOOKINGS`, as the lifecycle gate already uses. It never says why.

**Required tests before W3 ships** (emulator, real handler):

| # | Case | Expected |
|---|---|---|
| T1 | Existing tenant without the marker (fixtures shaped like whitecross / herohairs / legacy / approved-invite roots) | Public booking succeeds exactly as before (golden: same written booking doc) |
| T2 | New self-signup, marker `setup`, 0 services | Public refused, neutral code, nothing written |
| T3 | `setup`, services present, owner never opened | Refused |
| T4 | Owner opens with conditions unmet | Open refused, state unchanged |
| T5 | Owner opens with conditions met | `open` with actor/time; public booking succeeds |
| T6 | `paused` by owner | Public refused; Admin/Staff booking still succeeds |
| T7 | Privileged create / walk-in on a `setup` tenant | Succeeds (not gated) |
| T8 | Token reschedule / cancel on a `setup` tenant with an existing booking | Unchanged |
| T9 | Unknown marker value | Public refused (fail closed); privileged unchanged |
| T10 | Mutation: drop the "absent = open" branch | T1 fails (proves the compatibility test bites) |

Plus a read-only production census before release: count of tenants carrying any `onlineBooking.state` (expected 0). A non-zero count stops the release.

### 8.2 Additional requirements (owner, 2026-11-15)

**R1. The marker and the publication state are server-managed.**
- `onlineBooking.state` and its audit fields (`openedAt`, `openedBy`) are written only by the Admin SDK: `provisionTenant`, the approve saga, and the owner's "open/pause" callable.
- They must **not** be added to `tenantRootEditableKeys()` (`firestore.rules`, S8 allow-list). Because that rule judges `diff().affectedKeys()`, a client add, change **or delete** of the key is already refused.
- Required rules tests (S8 suite style), each as owner, admin, staff and anonymous:

| # | Case | Expected |
|---|---|---|
| RT1 | Delete `onlineBooking` | Refused |
| RT2 | Set `state: 'open'` | Refused |
| RT3 | Change `openedAt` / `openedBy` | Refused |
| RT4 | Overwrite the whole root without it | Refused |
| RT5 | Nested-map replacement | Refused |
| RT6 | Admin `create` of a missing root (rules `:583` allows the tenant's admin to create its own root with editable keys only) | A root re-created this way has **no marker**, which C1 would read as "open". The W3a design must close this. Recommended: narrow the create arm to super-admin. Pinned by a test; decided at W3a, not assumed here. |
| RT7 | Super-admin path unchanged | — |

**R2. C1 defines only this gate's effect.**
- "No marker = current behaviour" means only that the new readiness gate does not refuse.
- It skips none of the other checks, which stay in force in the same transaction and in the same order:
  - the tenant lifecycle capability (`createBooking.ts:745-748`);
  - status/suspension;
  - staff `availabilityFrom`/until and passive;
  - leave, slot conflicts and busy slots;
  - service `active`/`selfBooking`;
  - extras/options guards;
  - deposits;
  - the privileged role re-read.
- Test: T1's golden includes a no-marker tenant that is in grace/suspended. It must still be refused by the lifecycle gate.

**R3. Every tenant-creation path is inventoried and each gets an explicit policy.**
- The inventory below is from main `46d97d6f`. Each function's **live** lineage is re-measured at W3 release time (per-function live lineage).
- New salons do **not** arrive only through `/signup`.

| Path | Where | Today | Policy at W3b |
|---|---|---|---|
| Self-signup | `provisionTenant` (`index.ts:411`, `tenants/selfSignupProvision.ts:255` `tx.create`) | `onboardingComplete: false`, type from the form | write `onlineBooking.state: 'setup'` |
| Early-access approval / owner invite | `approveApplication` (`index.ts:3786`) → `onboarding/approveSaga.ts:275` `tx.create`; root at `index.ts:3833-3838` (type canonical from the application, `onboardingComplete: false`). The older approve code in provisionTenant's live source tree defaults `'barbershop'`, so measure the live `approveApplication` revision. | new salon | write `'setup'` (same rule as self-signup) |
| Co-create demo seeder | `scripts/cocreateDemo/seeder.cjs:263-268` (operator script, `onboardingComplete: false`) | demo/test | owner decides: `'setup'` or explicitly `'open'` for demos |
| UK demo seeder | `scripts/seedDemoTenant.cjs:293-297` (`'salon'`, `onboardingComplete: true`) | demo | explicit policy (likely no marker or `'open'`) |
| TR demo seeder | `scripts/seedTrDemoTenant.cjs:213-219` (`'Beauty'`, `onboardingComplete: true`) | demo | explicit policy |
| Super-admin / client | rules `allow create` (`firestore.rules:583`): super-admin, or admin of that tenant with editable keys only | not a product path | see RT6 |
| Rehearsal | `ops/rehearsals/newSalonReadiness.mjs` | test harness | follows the provisioning path it calls |

No other `tx.create`/`set` of a tenant root was found in `functions/src` (search: `tx.create(` on `tenantRef`; `businessType:` writers).

**R4. Release order (refined, binding).**
1. **W3a, guard first.** The server gate in `salownCreateBooking` (reads the marker; absent = this gate passes) plus the owner open/pause callable plus the rules tests RT1–RT7 and T1–T10. Since no tenant carries the marker yet, this release changes no behaviour for anyone.
2. **W3b, marker writers.** `provisionTenant` and `approveApplication` write `'setup'` for new tenants only, each its own live-lineage release.
3. **W2, skip UI.** "Do this later" / checklist, only after W3a and W3b are LIVE_VERIFIED.

Existing salons are never written or migrated at any step. W1 is independent: copy only, no gate, no marker.

### 8.3 W3a implementation record (2026-11-15; on main 2026-11-19 `ce1b32a7`; NOT deployed)

Claim `ONB-GUIDED-SETUP-W3A` (`alish/onb-w3a`, still open). Main **`ce1b32a7`** (2026-11-19, `[skip ci]`) = origin/main `7c5fb251` + one squashed W3a commit (tree `57700eda`, identical to the tested local head `7d3bfa18`). It carries the owner decisions Q1–Q4 (§8.3.6) and keeps both 18 Nov fixes: SEC-BOOKING-ANON-UPDATE-P0 (no anonymous bookings UPDATE arm) and the salOWN Stripe platform options (SALOWN_STRIPE_SECRET_KEY, maxInstances 12). **Main is not the release source**: the live-lineage units are in §8.3.5.

**8.3.1 What W3a does**

| Surface | Change |
|---|---|
| `functions/src/onboarding/onlineBookingGate.ts` (new) | Pure gate `onlineBookingGateAllowsPublic(root)`: no `onlineBooking` key → pass (C1); key present → only a map with `state === 'open'` passes; `setup`, `paused`, `null`, non-map, unknown or missing state refuse (T9). §3 readiness evaluation, owner action decision, and the transaction that applies it. |
| `createBookingCore` (`salownCreateBooking`) | Gate on the **public** branch only, directly after the lifecycle gate, on the root already read in the transaction, before any write. Same neutral reason `TENANT_NOT_ACCEPTING_BOOKINGS` (C4). The privileged branch (Admin / Staff-App) never reaches it (C3). |
| `salownCreateCheckoutSession` | Same gate on the same root read, before Stripe or any write. |
| `salownSetOnlineBooking` (new callable) | `{action: 'confirmHours' \| 'open' \| 'pause'}`. Outer gate: `gated()` (`NORMAL_SETTINGS`) + `requireTenantActor({roles:['owner']})` — claim tenant only, owner claim **and** owner staff doc, access status, lifecycle; super-admin is **not** admitted (D3: owner decision). Inside one transaction it re-reads the owner staff doc, the root, services, barbers and salon hours, re-checks §3 and writes a dotted-path patch on the marker map + one audit row. A tenant **without** the marker gets `NOT_APPLICABLE` and is **never written**. |
| `firestore.rules` | `tenantOnlineBookingOpen(tid)` added to the **anonymous** booking create (same root `get()` as `tenantAcceptsPublicBookings`, counted once). Tenant root (Q2): `allow create: if isSuperAdmin() && !('onlineBooking' in request.resource.data)`; `allow delete: if isSuperAdmin() && !('onlineBooking' in resource.data)`; super-admin update arm gains `onlineBookingUntouched()`. `onlineBooking` is not in `tenantRootEditableKeys()` (R1). No browser principal can add, change or delete the marker. |
| `createBooking.ts` exports | `resolveEffectiveStaffShift`, `barberStatusOf` and the new `serviceQualifies` (the candidate-set `qualifiedFor` now delegates to it) — so readiness uses the booking flow's own rules (Q4). Golden vs base unchanged. |

**8.3.2 Every entry that can create a booking** (main `9ffe39c1`; whitecross-site `d21fa91e`, read-only)

| Entry | Who | W3a gate |
|---|---|---|
| `salownCreateBooking` → `createBookingCore` public branch (hosted `/book`, `/s/` via `/book`, whitecross-site plain single booking) | public | **yes** |
| `salownCreateCheckoutSession` (deposit for an existing PENDING booking; does not create) | public | **yes** (defence in depth, mirrors the lifecycle gate) |
| Rules anonymous `create` on `bookings` — legacy BookingPage direct create (only if `HOSTED_BOOKING_CREATE_MODE` is switched to `'legacy'`; today `'callable'`), whitecross-site Extras bookings (`script.js:2400/2599/3478`) and group bookings (`:2861`) | public (client write) | **yes** (rules) |
| `salownCreateAdminBooking` / `salownCreateStaffBooking` (same core, `privileged`), `salownCreateWalkIn` / `salownCreateStaffWalkIn`, `salownCreateBlock`, product sale / checkout sale docs, panel direct `addDoc` (walk-in, sale, `blockTime`) | tenant staff | no (C3) |
| Platform imports: Booksy / Fresha / Treatwell email parsers, Treatwell iCal (`salownParseEmails`, `salownInboundEmail`, `salownParseInboxDispatch`, `salownManualImport`) | platform | no — a booking taken on another platform is not a salOWN online booking; **owner to confirm** (§8.3.6 Q3) |
| Operator seed scripts (`seedDemoTenant.cjs`, `cocreateDemo/seeder.cjs`) | operator (Admin SDK) | no |
| Update-only: Connect / Stripe webhooks (PENDING→CONFIRMED), `salownRescheduleByToken`, `salownCancelByToken`, `salownCleanupExpiredPending` | — | not a create; token paths unchanged (C3/T8) |
| whitecross-site `createCheckoutSession` (us-central1, Admin SDK merge-set on a client-named booking id) | public | not gated; whitecross carries no marker and is a separate repo; noted, out of scope |

**8.3.3 RT6 finding.** The tenant-admin create arm on the root was **already unreachable**: `isAdmin → isTenant → tenantLifecycleActive` `get()`s the root, and a missing root errors and denies (S8 §9 already asserted 403 for owner/admin/staff). It was therefore closed by an incidental property, not by a rule. Measured writers of a new root: `provisionTenant` (`selfSignupProvision.ts:255` `tx.create`), `approveApplication` (`approveSaga.ts:275` `tx.create`) — both Admin SDK — operator scripts (Admin SDK) and super-admin. No browser tenant writer exists, so narrowing the arm to `isSuperAdmin()` changes no effective permission. One browser super-admin writer does exist: Super Admin → Tenants → **Add Tenant** (`setDoc` in the separate super-admin repo; pinned by `ownerInviteRootStatusGuard` §5 and `ownerInviteLifecycle`). It is kept: a super-admin create is allowed only without the marker (Q2). Consequence for W3b: roots created by Add Tenant are unmarked (C1 = open) unless W3b moves Add Tenant to a server path. A marked root cannot be deleted from the browser (delete + re-create would strip the marker); deleting such a tenant needs an Admin SDK path. Server root writers use `update()` (never a whole-root `set()` without merge), so none can drop the marker. Dependencies updated with the change: S8 `§10f` (mutation anchor) and the `tenantAccessPolicy.test.js` S8 parity pin.

**8.3.4 Evidence** (handoff `~/release-work/onb-w3a-20261115/HANDOFF-2026-11-18.md` § "UPDATE 2026-11-19"; logs in `evidence/`)

*Gates on the main tree `57700eda` (local, 2026-11-19; port-remapped emulator copy, only `firebase.json` emulator ports differ):*
| Gate | Result |
|---|---|
| Functions unit (`npm test`) | PASS (0 fail) |
| Rules emulator gate (`ops/test-rules-emulator.sh`, 25 suites) | **478/478** |
| Functions emulator gate (`npm run test:emulator`, both phases) | general 1410/1410 + packages 27/27 = **1437/1437** (firebase-tools 15.26.0, emulator v1.22.0) |
| Root `vitest run` | 20 fail in 8 files — the **identical** failing set on origin/main `7c5fb251`; W3a touches none of those files |

*Release-unit gates (2026-11-19):* R `2e08baef` rules gate **455/455** (23 suites; §8 parity needs `W3A_MARKER_LIB`); C `452dcb24` build + unit 35/0 (12 skip); A `aa35b334` / B-narrow `2a326d8d` unchanged since their 15 Nov gates (marker module blob `972aea7b` = main).
Two test pins moved with the rebase: fcmTokens MAIN pre-A3 pin `e46fa8f8…` (recomputed with the suite's own reconstruction; origin/main reproduces its own `babd8a4f…`), and `onlineBookingMarker` §6 C3, which now asserts that an anonymous bookings UPDATE is refused on every tenant, marked or not.

*Functions emulator gate runtime (separate follow-up `TEST-APPROVESAGA-SNAPSHOT-SPEED`):* the gate needs ~64 min awake. `approveSaga.emulator.test.js` `snapshot()` walks every tenant left in the shared emulator by earlier files (measured: 394 tenants → 26.6 s for the first test, 0.46 s after an emulator clear). macOS lid-close sleep on battery kills the run (pmset timestamps match the observed hangs). Same on origin/main — not W3a.

**8.3.5 Release plan A → R (2026-11-19; nothing approved, nothing deployed).** Kit `~/release-work/onb-w3a-20261115/live/kit/README.md` § "CURRENT RELEASE PLAN".
- Live, measured read-only 2026-11-19: `salownCreateBooking` = `salowncreatebooking-00011-xer` (src `ffb9e9be`, 100 %); cloud.firestore = `2d81a63c` (served sha256 `244bc439…` = `667fe277:firestore.rules`); `salownSetOnlineBooking` absent.
- **Census** (read-only, field mask `onlineBooking` only, readTime 2026-11-19T18:58:32Z): **14 tenant roots, 14 ABSENT**, 0 marked; count(tenants) = 14.
1. **A** functions:salownCreateBooking ← `aa35b334` (on live `ffb9e9be`). `check.sh A` OK 19 Nov. Approval id `ONB-W3A-FN-BOOKING-AA35B334-<date>`. Rollback: traffic 100 % → `-00011-xer`.
2. **R** firestore:rules ← `2e08baef` (= the 4 W3a hunks on live `244bc439`, byte-equal; sha256 `6dd09c90…`). `check.sh R` OK 19 Nov. After A is post-verified. Approval id `ONB-W3A-RULES-2E08BAEF-<date>`. Rollback: re-release `2d81a63c` (keeps the anonymous-UPDATE removal).
- Expected behaviour change with 0 marked roots: none (C1). B-narrow `2a326d8d` and C `452dcb24` (U1-FIX `5bfd1a49`) are a separate decision under D4(b). W3b (marker writers) and W2 stay blocked until W3a is LIVE_VERIFIED.

**8.3.6 Owner decisions (2026-11-15) and how W3a implements them**
- **Q1 Hours confirmation is bound to one hours configuration.** `confirmHours` stores `hoursConfirmedAt/By` **and** `hoursConfirmedFingerprint` = sha256 of the weekly pattern (Sun–Sat start/end from the booking resolver, dated layers removed) of every ready staffer, sorted by id. Readiness compares it with the current value: none → `HOURS_NOT_CONFIRMED`, different → `HOURS_CHANGED`; a bare timestamp without a fingerprint does not count. It changes when a ready staffer's weekly shift changes, when salon hours change for a staffer who falls back to them, or when someone joins / leaves the ready set; dated leave, a closed day, names, services and bookings do not change it. **Effect on an open salon:** none — the public gate reads only `state`, so an `open` salon keeps taking bookings on its new hours; the stale confirmation blocks the **next** `open` (e.g. after a pause) until the owner confirms again. No trigger writes the marker. Unmarked salons: never written (`NOT_APPLICABLE`).
- **Q2 No browser principal writes the marker, super-admin included.** Rules above; RT7 now asserts super-admin refusal for dotted / map / nested / overwrite (incl. Add Tenant on an existing id) / mixed edits / create-with-marker / delete of a marked root, while plan / feature / telegram edits, Add Tenant and delete of an unmarked root still work. Broad-allow check: the only matches that can cover `tenants/{id}` are `/tenants/{tenantId}` and the root `/{document=**}`, which stays read-only (SEC-CATCHALL-1); mutation 7j restores its `write` and sees the bypass, 7g–7i drop each new guard.
- **Q3 Platform imports** (Booksy / Fresha / Treatwell parsers, iCal, manual import) stay outside the gate (static pin).
- **Q4 Staff readiness = the booking flow's rules, temporary states excluded.** Not ready: passive (status or `active:false`, absolute), `availabilityUntil` before today, a malformed availability date or an empty window, `leave` with no end that has begun, no weekday on which `resolveEffectiveStaffShift` gives a shift with end > start (dated `shiftChanges` ignored). Ready: dated leave (current or future), a future `availabilityFrom`, `availabilityUntil` today or later, a closed override today, own hours or the salon-hours fallback. Services: `active !== false`, `selfBooking !== false`, paired with a ready staffer through `serviceQualifies` (id or name; empty list = everyone). `open` re-checks services, staff and the hours confirmation inside its write transaction (unchanged).

## 9. Open questions and limits
- F4 and F5 come from code, not from a live observation. A read-only check of a test tenant (`settings/hours` against owner `dayHours`) would confirm F4 without writing.
- Booksy statements marked "search summary" were not confirmed: the help-centre pages returned 403.
- **Welcome mail:** delivery was observed by the owner (2026-11-15 01:42Z). From/Reply-To and SPF/DKIM/DMARC of that message were **not** inspected (`R-2026-11-15-A`). This note does not change that record; the ledger/ROADMAP label was made explicit in docs `6b6b624`.
