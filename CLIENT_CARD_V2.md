# CLIENT_CARD_V2 — Client card premium redesign + points-spend visibility

> Source: owner request 2026-07-11 (night, during the England–Norway match 😄).
> **Gate: TS migration feature-freeze — no code WRITTEN before 2026-07-14**
> (12=rc3, 13=product-validation). The review was done that night; code anchors below.

## 1. Finding — data EXISTS, visibility DOESN'T

The owner's intuition is right: the spent-points/discount data is already being collected but
it's shown nowhere on the client card.

| Data | Where it's written | Status in Clients |
|---|---|---|
| `loyaltyRedeemedValue` (£ value of points used at checkout) | `CheckoutPanel.tsx:930` (to the booking doc) | **NEVER READ** (Marketing.tsx:373 reads it for attribution, Clients.tsx 0 references) |
| `totalDiscount` (total discount per customer) | COMPUTED in client aggregation `Clients.tsx:187-188` | NOT in the stats row; only the per-booking chip in the history tab (`:820`) |
| Points movements | `auditLogs` — but ONLY `manual_points_adjustment` (`Clients.tsx:292`) | The Loyalty tab timeline shows manual adjustments; **points earned/spent at checkout are NOT in the timeline** |
| Current balance | `clients/{id}.loyaltyPoints` | ✅ shown (big number + progress bar) |

So: if a customer has used points 3 times, the only way to see it is to open the bookings one by
one in history. There's no answer to "how much value did they take from us".

## 2. Phase 1 — Loyalty visibility (cheap: ZERO new Firestore reads)

Bookings are already joined to the client (aggregation `Clients.tsx:174-215`) —
all of it can be derived client-side:

1. **Lifetime strip (Loyalty tab, below the balance card):**
   `Points used (£X)` = Σ `loyaltyRedeemedValue` · `Discounts (£Y)` =
   existing `totalDiscount` · `Total value received (£X+Y)`.
2. **Unified timeline:** manual adjustments (existing pointsLog) + checkout
   redemptions (`bookings.filter(b => b.loyaltyRedeemedValue > 0)` →
   date + "−N pts · £V off · <service>") + optional per-visit earn
   line (earn rate tenant config: `loyalty.earnRate`, cashback `points/20`
   legacy fallback — see salown-app/CLAUDE.md Money & loyalty).
3. **Stats row (top):** a second line in the `Points` box: "£X used lifetime"
   (or a 5th box "£ saved" in the 4-box group — design decision).

## 2b. Scope clarification (owner, 2026-07-11 second conversation)

**THE LIST DOESN'T CHANGE** — the table/search/segment/sort stay as-is. The redesign scope
= the client **panel** trio: (1) **adding** a customer, (2) **editing**,
(3) **holding/showing information** about the customer (detail drawer).

Current-state inventory (input to Claude Design):

| Piece | Today's state | Note |
|---|---|---|
| **Add** — `AddClientModal.tsx` (separate component, 540px Drawer) | Already modern: iconed inputs, +prefix phone, DD/Mo/YYYY birthday, nickname/reminder note, GDPR+loyalty hints, celebrate() | The newest of the trio; the redesign language can derive from here |
| **Edit** — `Clients.tsx:1047` (inline, 420px centered modal) | The OLDEST piece: flat input list (name/phone/email/birthday/notes), visual language doesn't match Add (native date input, no +prefix, no hints) | Behavior chain preserved: `_aliases` arrayUnion + `_origName` + booking rename (`:421-447`) |
| **Detail drawer** — `Clients.tsx:599-1045` (440px Drawer) | Avatar (barber-color ring)+VIP/tier/pts badges, phone/mail+unsubscribe toggle, 4 actions (Book/WhatsApp/Email/Campaign), 4-box stats, 3 tabs (overview/history/loyalty), notes blur-save | The owner's "too small" complaint is about this; 440px is narrow, info-dense |
| **Fields held** (client doc) | Only: name, phone, email, birthday, notes (+system: loyaltyPoints, isMember/membershipTier, emailOptOut, \_aliases, reengagementSentAt...) | Open question (owner decides): will new fields be added — address, gender/pronoun, referral source, **trusted** (§3c), emergency contact etc. Fresha/Booksy parity can be considered |

Since Add is already a Drawer, the real work is: **aligning edit with Add's language**
(or moving to the inline-edit in §3) + enlarging and enriching the detail drawer
+ expanding the set of fields held (owner decision).

## 3. Phase 2 — Premium card redesign (owner: "looks too small")

> ⚠️ **DESIGN OWNER = OWNER (2026-07-11):** the owner will have the card's visual redesign
> **done by themselves with Claude Design** — no session should PRODUCE its own
> mockup/design on its own initiative. The direction notes below are input
> material for Claude Design; the final visual decision comes from the owner. (Phase 1 = data
> visibility is INDEPENDENT of this, can be done once code is unblocked.)

Current: medium-size panel; 4-box stats; 3 tabs (overview/history/loyalty);
edit = simple centered modal (`Clients.tsx:1047`, flat input list).

Direction (same spirit as the Campaigns redesign language — the per-client drawer pattern already exists):
- **Full-height drawer** (from the right, wide) — instead of the small panel.
- **Hero header:** initials-avatar (source-color ring), name + member badge
  (◆ tier) + phone/email quick-actions (tel:/mailto: already exist in the history
  hover-card, pattern ready).
- **Stats band grows:** Visits · Total Spent · Avg/Visit · Points · **£ Saved**.
- **Inline edit:** instead of a separate modal, a pencil icon in the hero → fields turn to
  in-place edit (existing modal logic — alias arrayUnion `:433`, booking
  rename `:440` etc — kept AS-IS, only the presentation changes).
- **Quick actions row:** New booking · Send email · Adjust points ·
  (super-admin: merge/delete — existing permission gates DON'T CHANGE).

## 3b. Campaign history visibility (owner additional request, same night)

**Finding: the data + UI already EXIST but are buried.** When the History tab opens,
the `tenants/{id}/clients/{manualId}/campaignsSent` subcollection loads and is
listed (`Clients.tsx:250-262` load, `:834+` render) — the owner didn't
notice = discoverability problem. To do:
- **A "Last campaign" line in Overview:** in the Quick-info block (next to Last visit /
  Favourite service), the last campaign name + date (the first record of campaignsSent;
  it already comes sorted to History).
- **A badge in the Hero/drawer:** a single line like "📣 3 campaigns received · last: Birthday Treat,
  2 Jul" — clicking takes you to the History tab.
- Limit: only works for clients with a `manualId` (subcollection tied to the client
  doc) — if no manualId, the line is hidden, existing behavior.
- Later (merges with C7): opened/clicked status can be added to the line too
  (emailEvents already exists in the tenant; email matching is enough).

## 3c. Trusted client (owner additional request — Booksy parity, entering the list FOR THE FIRST TIME)

Origin: the Anthony case (memory `project_parser_priority`) — on Booksy a
"trusted client" is exempt from the deposit; when our parser assumed a fixed £10 deposit for
Booksy, it wrongly wrote "paid" for a trusted customer. It was discussed that day but had gotten
onto no list; this spec formalizes it.
- **Phase 1 (card field):** `trusted: boolean` (+ `trustedAt`,
  `trustedBy`) on the client doc — badge on the card (🤝 Trusted) + toggle (owner/admin permission;
  super-admin gate NOT REQUIRED, it's not a deletion). Purely a visual/operational marker:
  staff sees the "don't ask this customer for a deposit / trust their word" info.
- **Phase 2 (behavior, with Stripe Connect):** a client-level exception to the per-tenant payment
  policy (STRIPE_CONNECT_PLAN): `trusted=true` → deposit
  skipped (even if policy is 'deposit'). A single condition on the Booking page + BookingPage
  policy resolution. **When deposit isn't live, the behavioral effect is
  ZERO** — so Phase 1 can safely go first.
- **Parser tie (separate work, OUTSIDE C9 scope but related):** the Booksy parser should
  never hardcode the deposit; for trusted/no-deposit it should mark £0/unknown
  (the plan in project_parser_priority). The trusted flag also makes it easier to flag
  these false-positives.

## 4. To preserve (don't touch)

- Delete/merge = super-admin gates (`useAuth().isSuperAdmin`) AS-IS.
- The `_aliases` arrayUnion + `_origName` + booking-rename chain in Edit
  (`Clients.tsx:421-447`) stays behaviorally identical.
- Identity matching order (clientManualId → phone/email → aliases → name)
  — NORMALIZATION.md standards.
- MemberZone promote/demote flow (including the points-reset confirmation).

## 5. Effort / order suggestion

- **Phase 1** small (single file, client-side derive) → the first suitable slice after
  the migration; delivers value immediately ("this customer took £X value from us").
- **Phase 2** medium (design work; with the SERVICE_EDITOR_DESIGN_BRIEF pattern, first
  brief/mockup, owner approval, then code). Shouldn't block Phase 1 — separate slices.
