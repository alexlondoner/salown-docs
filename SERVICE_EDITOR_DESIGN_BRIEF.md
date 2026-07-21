# SERVICE_EDITOR_DESIGN_BRIEF.md — salOWN "Edit Service" Redesign

> **For:** the designer (Claude Design / any tool). **Goal:** a modern, clean service
> editor for salOWN — at least as good as Booksy/Fresha/Treatwell, with our own
> **squeeze-in / wait-time** concept as a first-class feature.
> **Hard rule:** this is a **visual redesign only**. The data model, calendar engine, and
> conflict/squeeze-in logic are DONE and must not change — design the *presentation*, we
> wire the existing logic underneath. Don't invent new behavior; style the fields below.

---

## 1. Context — what this screen is
salOWN is a multi-channel salon platform (aggregates Booksy/Fresha/Treatwell + walk-ins
into one calendar). The **Service editor** is where a salon owner defines a service:
name, price, duration, who performs it, and — our differentiator — **processing/wait time**
so a stylist can take another client during a wait (e.g. hair colour developing).

Today it's a single expanding card in a list. We want a **sectioned, modern editor**
(Fresha-style left-nav or clean stacked sections).

## 2. References (what to match / beat)
- **Booksy** "Edit Service → Settings": per-service fields — Booking interval, Padding,
  Processing time during/after, Parallel clients, Tax. No global toggle; the service owns its settings.
- **Fresha** "Edit service": left-nav sections (Basic details, Team, Resources, Add-ons,
  Online booking…), segment-based duration ("Add extra time": Servicing / Processing / Blocked).
- **Treatwell**: tabs (Services & Pricing, Description, Fine print, Distribution), cleanup time, team.
- **salOWN's edge:** the **squeeze-in** — the wait window is a *bookable gap* shown on the
  calendar; another client can be "squeezed in" there. This must feel intentional & premium.

## 3. Brand / style tokens (use these)
- **Accent (primary):** `#534AB7` (purple). Light accent `#EEEDFE`, hover `#AFA9EC`, dark `#3C3489`.
- **Danger:** `#A32D2D` / bg `#FCEBEB`.
- **Text/bg/border:** CSS vars (light+dark themes BOTH supported):
  `--color-text-primary/secondary/tertiary`, `--color-background-primary/secondary`,
  `--color-border-secondary/tertiary`, `--font-sans`.
- Existing UI is rounded (6–12px radii), soft borders (0.5–1px), compact, calm. Keep that.
- **Must work in light AND dark mode.**

## 4. Sections & fields (everything the design must include)

### A. Basics
- **Service name** (text)
- **Category / menu category** (select; salon-defined)
- **Treatment type** (text/select, optional) — marketplace matching (Fresha/Treatwell). Has a "?" help.
- **Description** (optional, multiline, char count)

### B. Pricing & timing  ← most important section
- **Price type**: Fixed / From / Free (select). "Free" hides price; "From" relabels price as "From £".
- **Price** (£), **Deposit** (£, optional)
- **Duration** (minutes) — the total service length.
- **⭐ Wait / squeeze-in (optional)** — the novel part. Three inputs:
  - **Active before** (min) — staff busy at start
  - **Wait (free)** (min) — staff FREE; another client can be squeezed in here
  - **Active after** — **auto-calculated** = Duration − before − wait (read-only, shown greyed)
  - Inline confirmation line: e.g. "✓ staff free 20 min (bookable gap) inside the 40 min service"
  - Validation: if before+wait > duration → red warning.
  - Each label has a "?" help tooltip (hover/click).
  - **Design the wait block as a premium, self-explanatory mini-module** — this is the hero feature.
    Ideally a small visual bar showing [active][free gap][active] proportions.
- **Variations** (optional) — toggle to "this service has variations" → rows of {name, duration, price}.
  When variations exist, the single price/duration/wait block is replaced by the variations table.
  (Wait/squeeze-in is base-service only for now — design can show it disabled/hidden when variations on.)

### C. Online booking
- **Allow self-booking** (toggle) — bookable online or staff-only.
- (Future, design placeholders ok): booking interval, padding/cleanup time.

### D. Capacity (future — design placeholder)
- **Parallel clients** (how many at once). Distinct from squeeze-in. Can be a "coming soon" stub.

### E. Team & resources
- **Who performs this** (multi-select chips of staff).
- (Future: rooms/resources.)

### F. Tax (future stub)
- **Tax rate** (select). Placeholder ok.

## 5. States to design
- **Empty / new service** vs **editing existing**.
- **Single-price** vs **variations** layouts.
- **Wait block:** off (collapsed/empty) → filled (shows the bar + confirmation) → invalid (warning).
- **Help tooltips** ("?" next to non-obvious labels: treatment type, wait fields, price type).
- **Validation** (red inline messages).
- **Save / Discard / Archive** actions.
- **Light + dark** mode.
- **Narrow width** (the editor opens inside a list/drawer — must work ~520–900px wide).

## 6. Squeeze-in — keep calendar consistency
On the calendar, a service with a wait shows a **striped "free" band** with a **"+ Squeeze in"**
pill (accent purple). The service editor's wait block should *visually rhyme* with that —
same idea of "active / free gap / active". Designer should look at the calendar treatment so
the two feel like one system. (Active = solid, Free/wait = striped/light, accent purple for the action.)

## 7. What NOT to do
- Don't add a global "enable processing" toggle — the **service owning a wait IS the switch** (Booksy model).
- Don't redesign the calendar here (separate). Just keep the wait block consistent with it.
- Don't change field semantics, the segment model, or conflict logic — visual only.
- Don't drop existing capabilities: variations, deposit, featured/active, archive, drag-reorder, categories.

## 8. Current implementation (so nothing's lost)
- File: `salown-app/src/pages/Services.jsx` (also a near-duplicate editor in `OnlineProfile.jsx`;
  the redesign should become the single home — sidebar "Services" → this page).
- Data written per service: `name, category, treatmentType, priceType, price, depositAmount,
  duration, segments[] (the wait, as {type:'service'|'processing'|'blocked', duration}), variations[],
  barbers[], active, featured`.
- The wait UI writes `segments[]` under the hood: before→service, wait→processing, after→service.
- Engine/calendar already consume `segments[]`. **Design doesn't touch this — just the fields above.**

## 9. Deliverable wanted from the designer
- High-fidelity mockup of the Service editor: all sections, single-price + variations, the wait
  block (empty/filled/invalid), tooltips, light+dark, save/discard.
- A short note mapping each visual element to the field names in §4/§8 (so implementation is 1:1).

> Related: `SERVICE_CONFIG_V2.md` (full field/architecture rationale), `BUSY_SLOT_V2.md`
> (calendar/engine), `BUSY_SLOT_V2_TESTPLAN.md` (what's verified). Read those for depth.
