// FIN-FEES prototype — pure derivations over a synthetic dataset.
//
// LOCAL PROTOTYPE ONLY. Nothing here is wired to Firebase, Stripe or any
// production reader, and nothing here is an accounting rule. It renders the
// B2 draft (docs/FIN_FEES_UX_DRAFT.md) under stated, UNAPPROVED assumptions:
//
//  * Revenue follows TODAY's Finance contract and never moves with fees:
//    a CHECKED_OUT booking contributes online leg + desk cash + desk card on
//    its service day; anything else contributes nothing.
//  * A refund is shown as a Stripe fact. Today's Finance does not read refunds,
//    so revenue is NOT reduced here either; a refund on a checked-out sale is
//    raised for review instead of being decided by this prototype.
//  * A stored (closed) month is never restated. Fee or refund facts that belong
//    to it are listed, never added.
//  * An unknown fee is never zero. Every total that would need it is reported
//    as an upper bound ("at most") with the missing coverage beside it.
//  * No payout data exists, so nothing is ever called bank money.

export type FeeState = 'actual' | 'pending' | 'not_recorded'
export type FeeDayAssumption = 'service' | 'payment'
export type MonthKey = string

export interface Capture {
  chargeRef: string
  paidOn: string
  gross_p: number
  fee_p: number | null
  feeState: FeeState
  second?: boolean
}

export interface RefundFact {
  refundedOn: string
  amount_p: number
}

export interface OnlineBooking {
  ref: string
  client: string
  scenario: string
  status: 'CHECKED_OUT' | 'CANCELLED'
  serviceOn: string
  paymentType: 'FULL' | 'DEPOSIT'
  /** What Finance's online leg reads for this booking (platformDepositAmount). */
  onlineLeg_p: number
  deskCash_p: number
  deskCard_p: number
  captures: Capture[]
  refunds: RefundFact[]
  review?: 'SECOND_CAPTURE'
}

export interface DeskDay { day: string; cash_p: number; card_p: number }
export interface TreatwellSale { day: string; card_p: number; twFee_p: number }

export interface MonthCosts {
  cashExpense_p: number
  bankExpense_p: number
  bankPaid_p: number
  cashPaid_p: number
  wages_p: number
  fixed_p: number
}

export interface StoredMonth {
  gross_p: number
  expensesCombined_p: number
  wages_p: number
  fixed_p: number
}

export interface Dataset {
  asOf: string
  ledgerStart: string
  closedMonths: Record<MonthKey, StoredMonth>
  desk: DeskDay[]
  treatwell: TreatwellSale[]
  online: OnlineBooking[]
  costs: Record<MonthKey, MonthCosts>
}

export const monthOf = (day: string): MonthKey => day.slice(0, 7)

// ── Fee attribution (the UNAPPROVED fee-day assumption lives only here) ──────

export type Attribution =
  | { kind: 'day'; day: string }
  | { kind: 'no_service_day' }
  | { kind: 'closed_month'; day: string }

export function attributeCapture(b: OnlineBooking, c: Capture, assumption: FeeDayAssumption, ds: Dataset): Attribution {
  const day = assumption === 'service'
    ? (b.status === 'CHECKED_OUT' ? b.serviceOn : null)
    : c.paidOn
  if (!day) return { kind: 'no_service_day' }
  if (ds.closedMonths[monthOf(day)]) return { kind: 'closed_month', day }
  return { kind: 'day', day }
}

export interface OutsideItem {
  ref: string
  chargeRef: string
  reason: 'no_service_day' | 'closed_month'
  month?: MonthKey
  fee_p: number | null
  feeState: FeeState
}

export interface FeeCoverage {
  captures: number
  known_p: number
  knownCount: number
  pendingCount: number
  pendingGross_p: number
  notRecordedCount: number
  notRecordedGross_p: number
  /** Captures related to this month whose fee is NOT in this month under the assumption. */
  outside: OutsideItem[]
}

export function feeCoverage(ds: Dataset, month: MonthKey, assumption: FeeDayAssumption): FeeCoverage {
  const out: FeeCoverage = {
    captures: 0, known_p: 0, knownCount: 0,
    pendingCount: 0, pendingGross_p: 0, notRecordedCount: 0, notRecordedGross_p: 0, outside: [],
  }
  for (const b of ds.online) {
    for (const c of b.captures) {
      const at = attributeCapture(b, c, assumption, ds)
      if (at.kind === 'day') {
        if (monthOf(at.day) !== month) continue
        out.captures++
        if (c.feeState === 'actual' && c.fee_p !== null) { out.known_p += c.fee_p; out.knownCount++ }
        else if (c.feeState === 'pending') { out.pendingCount++; out.pendingGross_p += c.gross_p }
        else { out.notRecordedCount++; out.notRecordedGross_p += c.gross_p }
        continue
      }
      const related = monthOf(c.paidOn) === month || (b.status === 'CHECKED_OUT' && monthOf(b.serviceOn) === month)
      if (!related) continue
      if (at.kind === 'closed_month' && monthOf(at.day) === month) continue
      out.outside.push({
        ref: b.ref,
        chargeRef: c.chargeRef,
        reason: at.kind,
        month: at.kind === 'closed_month' ? monthOf(at.day) : undefined,
        fee_p: c.feeState === 'actual' ? c.fee_p : null,
        feeState: c.feeState,
      })
    }
  }
  return out
}

export const coverageComplete = (c: FeeCoverage): boolean =>
  c.pendingCount === 0 && c.notRecordedCount === 0 && c.outside.length === 0

// ── Revenue — today's Finance contract, independent of fees ──────────────────

export interface MonthRevenue {
  cash_p: number
  card_p: number
  online_p: number
  treatwellFee_p: number
  gross_p: number
}

export function monthRevenue(ds: Dataset, month: MonthKey): MonthRevenue {
  let cash = 0, card = 0, online = 0, twFee = 0
  for (const d of ds.desk) if (monthOf(d.day) === month) { cash += d.cash_p; card += d.card_p }
  for (const t of ds.treatwell) if (monthOf(t.day) === month) { card += t.card_p; twFee += t.twFee_p }
  for (const b of ds.online) {
    if (b.status !== 'CHECKED_OUT' || monthOf(b.serviceOn) !== month) continue
    cash += b.deskCash_p; card += b.deskCard_p; online += b.onlineLeg_p
  }
  return { cash_p: cash, card_p: card, online_p: online, treatwellFee_p: twFee, gross_p: cash + card + online }
}

// ── Daily Ledger rows ────────────────────────────────────────────────────────

export interface DayRow {
  day: string
  cash_p: number
  card_p: number
  online_p: number
  gross_p: number
  treatwellFee_p: number
  knownFee_p: number
  pending: number
  notRecorded: number
  secondCapture: boolean
  /** gross − Treatwell fee − KNOWN Stripe fees; an upper bound when anything is unknown. */
  netAfterKnown_p: number
  atMost: boolean
}

export function dailyRows(ds: Dataset, month: MonthKey, assumption: FeeDayAssumption): DayRow[] {
  const rows = new Map<string, DayRow>()
  const row = (day: string): DayRow => {
    let r = rows.get(day)
    if (!r) {
      r = { day, cash_p: 0, card_p: 0, online_p: 0, gross_p: 0, treatwellFee_p: 0, knownFee_p: 0,
        pending: 0, notRecorded: 0, secondCapture: false, netAfterKnown_p: 0, atMost: false }
      rows.set(day, r)
    }
    return r
  }
  for (const d of ds.desk) if (monthOf(d.day) === month) { const r = row(d.day); r.cash_p += d.cash_p; r.card_p += d.card_p }
  for (const t of ds.treatwell) if (monthOf(t.day) === month) { const r = row(t.day); r.card_p += t.card_p; r.treatwellFee_p += t.twFee_p }
  for (const b of ds.online) {
    if (b.status === 'CHECKED_OUT' && monthOf(b.serviceOn) === month) {
      const r = row(b.serviceOn)
      r.cash_p += b.deskCash_p; r.card_p += b.deskCard_p; r.online_p += b.onlineLeg_p
    }
    for (const c of b.captures) {
      const at = attributeCapture(b, c, assumption, ds)
      if (at.kind !== 'day' || monthOf(at.day) !== month) continue
      const r = row(at.day)
      if (c.feeState === 'actual' && c.fee_p !== null) r.knownFee_p += c.fee_p
      else if (c.feeState === 'pending') r.pending++
      else r.notRecorded++
      if (c.second) r.secondCapture = true
    }
  }
  return [...rows.values()]
    .map((r) => {
      r.gross_p = r.cash_p + r.card_p + r.online_p
      r.netAfterKnown_p = r.gross_p - r.treatwellFee_p - r.knownFee_p
      r.atMost = r.pending + r.notRecorded > 0
      return r
    })
    .sort((a, b) => a.day.localeCompare(b.day))
}

// ── Stripe activity by PAYMENT date (provider view, not bank money) ─────────

export interface StripeActivity {
  captured_p: number
  captureCount: number
  bookingCount: number
  knownFee_p: number
  knownCount: number
  pendingCount: number
  pendingGross_p: number
  notRecordedCount: number
  notRecordedGross_p: number
  refunded_p: number
  refundCount: number
  secondCaptures: number
  afterKnown_p: number
  complete: boolean
}

export function stripeActivity(ds: Dataset, month: MonthKey): StripeActivity {
  const a: StripeActivity = {
    captured_p: 0, captureCount: 0, bookingCount: 0, knownFee_p: 0, knownCount: 0,
    pendingCount: 0, pendingGross_p: 0, notRecordedCount: 0, notRecordedGross_p: 0,
    refunded_p: 0, refundCount: 0, secondCaptures: 0, afterKnown_p: 0, complete: true,
  }
  for (const b of ds.online) {
    let touched = false
    for (const c of b.captures) {
      if (monthOf(c.paidOn) !== month) continue
      touched = true
      a.captured_p += c.gross_p; a.captureCount++
      if (c.second) a.secondCaptures++
      if (c.feeState === 'actual' && c.fee_p !== null) { a.knownFee_p += c.fee_p; a.knownCount++ }
      else if (c.feeState === 'pending') { a.pendingCount++; a.pendingGross_p += c.gross_p }
      else { a.notRecordedCount++; a.notRecordedGross_p += c.gross_p }
    }
    if (touched) a.bookingCount++
    for (const r of b.refunds) if (monthOf(r.refundedOn) === month) { a.refunded_p += r.amount_p; a.refundCount++ }
  }
  a.afterKnown_p = a.captured_p - a.knownFee_p - a.refunded_p
  a.complete = a.pendingCount === 0 && a.notRecordedCount === 0
  return a
}

// ── Review items — raised, never resolved here ───────────────────────────────

export interface ReviewItem {
  ref: string
  kind: 'SECOND_CAPTURE' | 'REFUND_AFTER_CHECKOUT' | 'REFUND_ON_CLOSED_MONTH_SALE'
  amount_p: number
  day: string
}

export function reviewItems(ds: Dataset, month: MonthKey): ReviewItem[] {
  const out: ReviewItem[] = []
  for (const b of ds.online) {
    if (b.review === 'SECOND_CAPTURE') {
      for (const c of b.captures) if (c.second && monthOf(c.paidOn) === month) {
        out.push({ ref: b.ref, kind: 'SECOND_CAPTURE', amount_p: c.gross_p, day: c.paidOn })
      }
    }
    if (b.status !== 'CHECKED_OUT') continue
    for (const r of b.refunds) {
      if (monthOf(r.refundedOn) !== month) continue
      const closed = !!ds.closedMonths[monthOf(b.serviceOn)]
      out.push({ ref: b.ref, kind: closed ? 'REFUND_ON_CLOSED_MONTH_SALE' : 'REFUND_AFTER_CHECKOUT', amount_p: r.amount_p, day: r.refundedOn })
    }
  }
  return out.sort((x, y) => x.day.localeCompare(y.day))
}

// ── One booking, on the online rail ──────────────────────────────────────────

export interface BookingView {
  gross_p: number
  knownFee_p: number
  unknownFees: FeeState[]
  refunded_p: number
  refundKind: 'none' | 'partial' | 'full'
  afterFeeAndRefunds_p: number
  atMost: boolean
  /** What today's Finance counts for this booking (service day, CHECKED_OUT only). */
  financeRevenue_p: number
}

export function bookingView(b: OnlineBooking): BookingView {
  const gross = b.captures.reduce((s, c) => s + c.gross_p, 0)
  const known = b.captures.reduce((s, c) => s + (c.feeState === 'actual' && c.fee_p !== null ? c.fee_p : 0), 0)
  const unknown = b.captures.filter((c) => c.feeState !== 'actual').map((c) => c.feeState)
  const refunded = b.refunds.reduce((s, r) => s + r.amount_p, 0)
  const firstCapture = b.captures.find((c) => !c.second)?.gross_p ?? 0
  return {
    gross_p: gross,
    knownFee_p: known,
    unknownFees: unknown,
    refunded_p: refunded,
    refundKind: refunded === 0 ? 'none' : refunded >= firstCapture ? 'full' : 'partial',
    afterFeeAndRefunds_p: gross - known - refunded,
    atMost: unknown.length > 0,
    financeRevenue_p: b.status === 'CHECKED_OUT' ? b.onlineLeg_p + b.deskCash_p + b.deskCard_p : 0,
  }
}

export function bookingsInMonth(ds: Dataset, month: MonthKey): OnlineBooking[] {
  return ds.online.filter((b) =>
    monthOf(b.serviceOn) === month
    || b.captures.some((c) => monthOf(c.paidOn) === month)
    || b.refunds.some((r) => monthOf(r.refundedOn) === month))
}
