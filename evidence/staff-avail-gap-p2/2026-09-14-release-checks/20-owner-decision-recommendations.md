# STAFF-AVAIL-GAP Phase 2 — recommendations for the owner decisions (NOT decisions)

Written 2026-09-13 for salown-app `9ea0aca`. Nothing below changes scope, code, authorization or rules.
Every option is a proposal for the owner; none was implemented.

## 1. Deferring the Walk-in↔Reschedule race criterion to Phase 3

**What the criterion would prove.** That a Staff walk-in and a Staff reschedule racing for the same
barber/time cannot both land (§7.2, §8).

**Why it cannot be met today.** Reschedule has no server surface: `src/staff/sheets/RescheduleSheet.tsx`
checks `hasTimeConflict` in the browser, offers `window.confirm` (`staffApp.reschedule.conflictConfirm`)
and writes with a raw `updateDoc`. Admin `BookingDetailPanel` reschedule is the same shape (§3.1).
A race test needs both writers to read the conflict set inside a transaction; one of them does not.

**Risk of deferring.**
- The deferral adds no new exposure. With or without Phase 2, a reschedule can move a booking onto a
  walk-in's slot *sequentially* — no race needed — whenever staff click through the confirm. The race is a
  strict subset of that already-open, larger gap.
- What Phase 2 does change: a walk-in can no longer be created onto an existing reschedule (the walk-in
  transaction sees the rescheduled booking). The reverse direction stays open until Phase 3.
- Reporting risk: "walk-in is race-safe" would be over-claimed if stated without the pair list.

**Recommendation.** Accept the deferral explicitly, recorded in §8's pair table as
`Walk-in↔Reschedule — NOT RUN (Phase 3 prerequisite)`, and make it a Phase 3 acceptance criterion
(already listed there). Do not describe Phase 2 as race-safe against reschedules.

## 2. Staff bypassing Phase 2 through the Admin `salownCreateWalkIn`

**Facts.**
- `salownCreateWalkIn` accepts roles owner/admin/staff (and a superAdmin claim) and, on the Admin surface,
  runs passive/not-started only — no leave, shift or conflict check (`functions/src/bookings/createWalkIn.ts`).
- Staff legitimately reach it from the Admin panel: `Sidebar.tsx` `OWNER_ONLY` does not contain
  `dashboard` or `clients`, and `AppRouter.tsx` mounts `Dashboard` (WalkInForm walk-in tab) and `Clients`
  (quick book) for the staff role with `isAdmin=false`.
- Admin client guards are browser-only: WalkInForm walk-in tab hard-alerts "not working on this day"
  from the client-side shift, soft-confirms conflict and salon-hours; Clients quick book soft-confirms
  conflict only. Any authenticated staff member can also call the callable directly.

**Options and impact on the current Admin flow.**

| Option | Closes the staff bypass? | Impact on Admin flow |
|---|---|---|
| A. Deny `staff` on `salownCreateWalkIn` (owner/admin only) | Yes for the callable | **Breaks** staff walk-ins from Admin Calendar and Clients quick book (currently allowed). Admin also still bypasses. |
| B. Run the shared `staffPolicyGate` on `salownCreateWalkIn` for every role (the Staff surface semantics) | Yes, for staff and admin | Admin walk-ins start being refused on leave/off-shift/conflict. Owner override needs a reason prompt in WalkInForm and Clients that does not exist → owners lose their current click-through until UI work lands. The existing soft confirms become misleading and must go. |
| C. Run the gate on `salownCreateWalkIn` only when the re-read role is `staff`; owner/admin keep legacy parity | Yes for staff | Staff using Admin Calendar/Clients get the same refusals as in the Staff App; the Admin UI needs the refusal messages mapped (no override prompt for staff by design). Owner/admin unchanged. Leaves an **admin** bypass open, which D3 does not permit to override — must be named. |
| D. Accept as a named exception for the Phase 2 release | No | None now; the bypass stays documented next to the rules bypass. |

**Recommendation.** Do not release Phase 2 as "enforced" while this is undecided. Preferred order:
**D for the release decision only if the owner accepts it in writing, with C as the next change** (smallest
closure that does not break staff's Admin-panel walk-ins or owners' current workflow), then B when an Admin
owner-override UI exists. Option A should be rejected: it removes a legitimate staff workflow rather than
enforcing policy on it. Whichever is chosen, it must also be covered by §9.4's rules migration (the callable
is an Admin-SDK writer, so narrowing `firestore.rules` does not close it).

## 3. What may be claimed while the `firestore.rules` bypass is open

`isTenantAny(tenantId)` lets any authenticated tenant member create/update `bookings` directly (§9.4).

**Supportable claim (if released):**
> "Phase 2 Walk-in callable transition published: the Staff App walk-in (Save and Save & Checkout) now
> creates through `salownCreateStaffWalkIn`, which refuses undated leave, off-shift and conflicting times
> (owner-only, reason-required, audited override; blocked time never overridable) for users of the new
> Staff App build."

**Not supportable:**
- "staff can no longer double-book / book on leave" (direct Firestore writes, the Admin callable, and
  cached old Staff bundles all bypass it);
- "STAFF-AVAIL-GAP closed" or "fully enforced";
- "walk-ins are race-safe" without the pair list (parsers/aggregators and reschedules do not coordinate);
- any claim about Admin walk-ins or Clients quick book.

**Recommendation.** Use only the supportable sentence, always with the three named bypasses beside it.

## 4. Staff notice draft (not sent)

**EN**
> From [date], the Staff App checks walk-ins on the server before saving.
> - A walk-in that overlaps an existing booking, or falls outside the professional's shift, will be refused.
>   Only the owner can approve an exception, and must enter a reason.
> - A walk-in for a professional on approved leave will always be refused (unless the rota already has an
>   open shift for that date).
> - Blocked time and breaks can never be booked over.
> - "Save & checkout" without choosing a time records the start as "now minus the service length"; if that
>   overlaps the previous client or starts before the shift, it will also be refused.
> If a save is refused, nothing was saved — pick another time or ask the owner.

**TR**
> [tarih] itibarıyla Staff App, walk-in kayıtlarını kaydetmeden önce sunucuda kontrol ediyor.
> - Mevcut bir randevuyla çakışan ya da çalışanın mesaisi dışında kalan walk-in reddedilir. İstisnayı
>   yalnız işletme sahibi, gerekçe yazarak onaylayabilir.
> - Onaylı izindeki çalışana walk-in her zaman reddedilir (o gün için vardiya planında açık bir mesai yoksa).
> - Bloke edilmiş zaman ve molaların üzerine kayıt yapılamaz.
> - Saat seçmeden "Kaydet ve öde" kullanıldığında başlangıç "şimdi eksi hizmet süresi" olarak yazılır; bu
>   önceki müşteriyle çakışır ya da mesai öncesine düşerse o da reddedilir.
> Kayıt reddedilirse hiçbir şey kaydedilmemiştir — başka bir saat seçin ya da işletme sahibine danışın.

## 5. Is "keep the callable deployed during rollback" enough for old clients?

**Covered.**
- Tabs still running the new bundle after a hosting rollback keep calling `salownCreateStaffWalkIn`; keeping it
  deployed keeps them working and enforced. `salownCreateStaffBooking` is untouched by the release, so their
  New Booking tab keeps working either way (compat matrix: identical responses).
- Data written by the new callable has the existing booking shape; readers need no rollback.

**Not covered — gaps in the current plan.**
1. **No drain signal.** Nothing tells us when new-bundle tabs are gone. `sw.js` is unchanged by the release,
   so no `controllerchange` reload fires; `Cache-Control: no-cache` only helps on the next navigation.
   Recommendation: before any delete, read the function's invocation count in Cloud Logging for a quiet period
   (read-only), or keep the function indefinitely — it is stricter than the callable the old bundle uses.
2. **Offline devices.** `sw.js` falls back to cached assets offline, so a device can keep the new bundle beyond
   the drain window. Another reason not to delete the function on a timer.
3. **The reverse direction at release time.** Tabs open on the OLD bundle (`62aa1ac4a0302593`) keep using
   `salownCreateWalkIn` without the gate until reloaded — that is a *release* exposure, not a rollback one,
   and the callable-keep approach does nothing for it. Only a reload prompt/forced-refresh mechanism would.
4. **Idempotency across the switch.** A new-bundle retry that reaches the function after deletion fails with
   404 and writes nothing (safe), but the operator sees the generic failure text.

**Verdict.** Sufficient for correctness (no lost or duplicated writes) during a rollback; **not sufficient**
for knowing when it is safe to delete the function, and irrelevant to old-bundle exposure at release time.
Recommendation: keep the function after a rollback until a read-only invocation check shows no traffic, and
treat old-bundle exposure as part of decision 2/3 above.
