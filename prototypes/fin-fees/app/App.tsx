// FIN-FEES — local visual prototype of docs/FIN_FEES_UX_DRAFT.md.
//
// Two layers, kept apart on purpose:
//  * PRODUCT COPY — what an owner would read on the Finance screen: fee and
//    data-state messages only. It never says "prototype", "assumption" or
//    "not approved".
//  * DESIGN NOTES — why the screen looks like this, which assumption placed a
//    number, and what is still an open decision. Rendered only when the
//    "Design notes" switch in the prototype bar is on, in a visibly different
//    style, and never inside a product sentence.
//
// Mirrors the design tokens and section shapes of salown-app src/pages/Finance.tsx
// over SYNTHETIC data. No Firebase, no Stripe, no production reader. Not an
// accounting rule.
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DATASET as ds } from './data'
import {
  attributeCapture, bookingView, bookingsInMonth, coverageComplete, dailyRows, feeCoverage, monthOf, monthRevenue,
  reviewItems, stripeActivity,
  type FeeCoverage, type FeeDayAssumption, type OnlineBooking, type ReviewItem,
} from './model'

// --- Design tokens copied from Finance.tsx (~171-182, 1495-1497) ---
const A = '#534AB7', OK = '#2f7d5b', NEG = '#d64545', EXP = '#ff7043', FEE = '#c0392b', ONLINE = '#8e44ad', WARN = '#8a6d0b'
const FONT = "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,system-ui,sans-serif"
const card: CSSProperties = { background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 1px 2px rgba(17,24,39,0.04)' }
const thS: CSSProperties = { padding: '9px 11px', fontSize: '0.62rem', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '2px solid rgba(83,74,183,0.20)' }
const tdS = (color?: string, bold = false): CSSProperties => ({ padding: '8px 11px', fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', color: color ?? 'var(--text)', fontWeight: bold ? 700 : 500, fontFamily: FONT })
const chip = (bg: string, fg: string): CSSProperties => ({ background: bg, color: fg, borderRadius: '99px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' })
const colHead = (color: string): CSSProperties => ({ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color })
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 14px', fontSize: '0.76rem', marginTop: '10px' }
const muted: CSSProperties = { color: 'var(--muted)' }
const strong: CSSProperties = { color: 'var(--text)', fontWeight: 700 }

const gbp = (p: number) => `£${(Math.abs(p) / 100).toFixed(2)}`
const minus = (p: number) => `−${gbp(p)}`
const signed = (p: number) => `${p < 0 ? '−' : '+'}${gbp(p)}`
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const MONTHS: Record<string, string> = { '2026-08': 'August 2026', '2026-09': 'September 2026' }
const MONTH_KEYS = Object.keys(MONTHS)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// ── Design-note layer ────────────────────────────────────────────────────────

const NotesOn = createContext(false)

/** A design note. Never product copy; invisible unless the prototype bar turns notes on. */
function Note({ children, inline = false }: { children: ReactNode; inline?: boolean }) {
  const on = useContext(NotesOn)
  if (!on) return null
  const style: CSSProperties = {
    display: inline ? 'inline-block' : 'block',
    margin: inline ? '0 0 0 6px' : '8px 0 0',
    padding: '6px 10px',
    border: '1.5px dashed #0e7490',
    borderRadius: 8,
    background: 'rgba(14,116,144,0.07)',
    color: '#0e7490',
    fontSize: '0.66rem',
    lineHeight: 1.5,
    fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
    fontWeight: 500,
    textAlign: 'left',
    whiteSpace: 'normal',
  }
  return <div style={style}><strong style={{ letterSpacing: '0.06em' }}>DESIGN NOTE</strong> · {children}</div>
}

// ── Product atoms ────────────────────────────────────────────────────────────

/** A money figure that may still fall once missing fees are known. */
function UpTo({ p, incomplete, color, size }: { p: number; incomplete: boolean; color: string; size?: string }) {
  return (
    <span style={{ color, fontWeight: 800, fontSize: size }}>
      {incomplete && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: WARN, marginRight: 4 }}>up to</span>}
      {signed(p)}
    </span>
  )
}

function Tag({ tone, children, title }: { tone: 'warn' | 'info' | 'neg' | 'ok' | 'muted'; children: ReactNode; title?: string }) {
  const map = { warn: ['#fdf6dd', WARN], info: ['#EEEDFE', A], neg: ['#fdecec', NEG], ok: ['#e7f4ee', OK], muted: ['var(--card)', 'var(--muted)'] } as const
  const [bg, fg] = map[tone]
  return <span title={title} style={{ ...chip(bg, fg), border: '1px solid var(--border)', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.03em' }}>{children}</span>
}

// ── Prototype bar (outside the product frame) ────────────────────────────────

function PrototypeBar(props: {
  assumption: FeeDayAssumption; setAssumption: (a: FeeDayAssumption) => void
  notes: boolean; setNotes: (v: boolean) => void
  theme: string; setTheme: (t: string) => void
}) {
  const btn = (active: boolean): CSSProperties => ({ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.25)', background: active ? '#22d3ee' : 'transparent', color: active ? '#0b1220' : '#e2e8f0', fontWeight: 700, fontSize: '0.66rem', cursor: 'pointer', fontFamily: 'inherit' })
  return (
    <div style={{ background: '#0b1220', color: '#e2e8f0', fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace", fontSize: '0.68rem', padding: '8px 20px', display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
      <strong style={{ color: '#22d3ee' }}>PROTOTYPE</strong>
      <span>synthetic data · not connected to any account · not product copy</span>
      <span style={{ marginLeft: 'auto' }}>fee day:</span>
      <button style={btn(props.assumption === 'service')} onClick={() => props.setAssumption('service')}>checkout day (owner decision)</button>
      <button style={btn(props.assumption === 'payment')} onClick={() => props.setAssumption('payment')}>payment day (comparison)</button>
      <span>design notes:</span>
      <button style={btn(props.notes)} onClick={() => props.setNotes(!props.notes)}>{props.notes ? 'on' : 'off'}</button>
      <button style={btn(false)} onClick={() => props.setTheme(props.theme === 'light' ? 'dark' : 'light')}>{props.theme === 'light' ? 'dark' : 'light'}</button>
    </div>
  )
}

function AssumptionNotes({ assumption }: { assumption: FeeDayAssumption }) {
  return (
    <Note>
      Fee day is placed by <b>{assumption === 'service' ? 'CHECKOUT DAY — owner decision 2026-09-15' : 'PAYMENT DAY — comparison view only'}</b>.
      Still open: a checkout on a different day from the booking's start time; the fee on a cancelled, refunded booking; refund day.
      Revenue follows today's Finance contract (checked-out sales, service day) and never moves with fees.
      Refunds are shown from Stripe; today's Finance does not read them, so revenue is not reduced (open decision; a ledger entry needs B1b).
      Closed months keep stored figures; only the existing super-admin post-close adjustment could change one — the prototype makes none.
      Payouts are not recorded, so nothing is bank money. Fee tracking start (synthetic): 5 Sep 2026 09:00 UTC. As of 14 Sep 2026 16:00.
      Fee amounts are illustrative, not Stripe pricing.
    </Note>
  )
}

function Header({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const i = MONTH_KEYS.indexOf(month)
  const nav = (enabled: boolean): CSSProperties => ({ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card2)', color: enabled ? 'var(--text)' : 'var(--muted2)', cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit' })
  const pill = (active: boolean): CSSProperties => ({ padding: '6px 12px', borderRadius: 99, border: '1px solid var(--border)', background: active ? A : 'var(--card2)', color: active ? '#fff' : 'var(--muted)', fontSize: '0.7rem', fontWeight: 700, cursor: active ? 'default' : 'not-allowed', fontFamily: 'inherit' })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
      <div>
        <div style={{ fontSize: '0.64rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Whitecross · Finance</div>
        <h2 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>Finance</h2>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={pill(false)} disabled>Day</button>
        <button style={pill(false)} disabled>Week</button>
        <button style={pill(true)}>Month</button>
        <button style={nav(i > 0)} disabled={i <= 0} onClick={() => setMonth(MONTH_KEYS[i - 1])}>‹</button>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', minWidth: 130, textAlign: 'center' }}>
          {MONTHS[month]} {ds.closedMonths[month] && <Tag tone="muted">Closed</Tag>}
        </span>
        <button style={nav(i < MONTH_KEYS.length - 1)} disabled={i >= MONTH_KEYS.length - 1} onClick={() => setMonth(MONTH_KEYS[i + 1])}>›</button>
      </div>
    </div>
  )
}

// ── P&L waterfall ────────────────────────────────────────────────────────────

function CoverageLines({ cov }: { cov: FeeCoverage }) {
  const sub: CSSProperties = { ...muted, fontSize: '0.68rem', paddingLeft: 10 }
  return (
    <>
      {cov.pendingCount > 0 && <><span style={sub}>{plural(cov.pendingCount, 'fee', 'fees')} not yet confirmed by Stripe ({gbp(cov.pendingGross_p)} taken)</span><span style={{ ...sub, textAlign: 'right' }}>not included</span></>}
      {cov.notRecordedCount > 0 && <><span style={sub}>{plural(cov.notRecordedCount, 'payment', 'payments')} with no fee record ({gbp(cov.notRecordedGross_p)} taken)</span><span style={{ ...sub, textAlign: 'right' }}>not included</span></>}
      {cov.outside.length > 0 && <><span style={sub}>{plural(cov.outside.length, 'fee', 'fees')} not on any day of this month</span><span style={{ ...sub, textAlign: 'right' }}>see Daily Ledger</span></>}
    </>
  )
}

function OpenMonthWaterfall({ month, assumption }: { month: string; assumption: FeeDayAssumption }) {
  const rev = monthRevenue(ds, month)
  const cov = feeCoverage(ds, month, assumption)
  const costs = ds.costs[month]
  const incomplete = !coverageComplete(cov)
  const netToday = rev.gross_p - costs.cashExpense_p - costs.bankExpense_p - rev.treatwellFee_p
  const netAfterKnown = netToday - cov.known_p
  const netPL = netAfterKnown - costs.wages_p - costs.fixed_p
  return (
    <div id="waterfall" style={{ ...card, padding: '22px 26px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: '24px 0' }}>
        <div style={{ flex: '1.2 1 250px', minWidth: 250, paddingRight: 26 }}>
          <div style={colHead('var(--muted)')}>Gross Revenue</div>
          <div style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginTop: 2 }}>{gbp(rev.gross_p)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={chip('#f3e8f9', ONLINE)}>Online (prepaid) {gbp(rev.online_p)}</span>
          </div>
          <Note>Gross is identical under both fee-day assumptions and with or without fees (pinned by model.test.ts).</Note>
        </div>
        <div style={{ flex: '1.3 1 300px', minWidth: 300, borderLeft: '1px solid var(--border)', padding: '0 22px' }}>
          <div style={colHead(EXP)}>− Expenses &amp; Fees</div>
          <div style={grid2}>
            <span style={muted}>Cash expenses</span><span style={{ color: EXP, fontWeight: 700, textAlign: 'right' }}>{minus(costs.cashExpense_p)}</span>
            <span style={muted}>Bank expenses</span><span style={{ color: EXP, fontWeight: 700, textAlign: 'right' }}>{minus(costs.bankExpense_p)}</span>
            {rev.treatwellFee_p > 0 && <><span style={muted}>Treatwell fees</span><span style={{ color: FEE, fontWeight: 700, textAlign: 'right' }}>{minus(rev.treatwellFee_p)}</span></>}
            <span style={muted}>Stripe fees (website) <span style={{ fontSize: '0.64rem' }}>· {cov.knownCount} of {cov.captures} confirmed</span></span>
            <span style={{ color: FEE, fontWeight: 700, textAlign: 'right' }}>{minus(cov.known_p)}</span>
            <CoverageLines cov={cov} />
            <span style={{ color: 'var(--text)', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 4 }}>Net Revenue</span>
            <span style={{ textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: 4 }}><UpTo p={netAfterKnown} incomplete={incomplete} color="#7E57C2" /></span>
          </div>
          {incomplete && <div style={{ fontSize: '0.66rem', color: WARN, marginTop: 6 }}>Some Stripe fees aren't known yet, so Net Revenue may be lower.</div>}
          <Note>Today's live formula (no Stripe fees) would show {gbp(netToday)}. "up to" is an honest upper bound: an unknown fee can only lower the figure.</Note>
        </div>
        <div style={{ flex: '1 1 190px', minWidth: 190, borderLeft: '1px solid var(--border)', padding: '0 22px' }}>
          <div style={colHead(OK)}>− Operating Costs</div>
          <div style={grid2}>
            <span style={muted}>Total wages <span style={{ fontSize: '0.6rem' }}>(accrual)</span></span><span style={{ color: OK, fontWeight: 700, textAlign: 'right' }}>{minus(costs.wages_p)}</span>
            <span style={muted}>Fixed · 12d × £120</span><span style={{ color: '#78909c', fontWeight: 700, textAlign: 'right' }}>{minus(costs.fixed_p)}</span>
            <span style={{ color: 'var(--text)', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 4 }}>Total cost</span><span style={{ color: 'var(--text)', fontWeight: 800, textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: 4 }}>{minus(costs.wages_p + costs.fixed_p)}</span>
          </div>
        </div>
        <div style={{ flex: '1 1 190px', minWidth: 190, borderLeft: '1px solid var(--border)', paddingLeft: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={colHead('var(--muted)')}>= Net P&amp;L · {MONTHS[month]}</div>
          <div style={{ letterSpacing: '-0.02em', marginTop: 4 }}><UpTo p={netPL} incomplete={incomplete} color={netPL >= 0 ? OK : NEG} size="2rem" /></div>
          <div style={{ fontSize: '0.68rem', ...muted, marginTop: 4 }}>Net Revenue − Wages − Fixed Cost</div>
          {incomplete && <div style={{ fontSize: '0.66rem', color: WARN, marginTop: 2 }}>Final once every Stripe fee is confirmed.</div>}
        </div>
      </div>
    </div>
  )
}

function ClosedMonthWaterfall({ month }: { month: string }) {
  const s = ds.closedMonths[month]
  const netRevenue = s.gross_p - s.expensesCombined_p
  const netPL = netRevenue - s.wages_p - s.fixed_p
  return (
    <>
      <div id="waterfall" style={{ ...card, padding: '22px 26px', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap', gap: '24px 0' }}>
          <div style={{ flex: '1.2 1 250px', minWidth: 250, paddingRight: 26 }}>
            <div style={colHead('var(--muted)')}>Gross Revenue</div>
            <div style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text)', marginTop: 2 }}>{gbp(s.gross_p)}</div>
            <div style={{ fontSize: '0.66rem', ...muted, marginTop: 12 }}>Revenue breakdown is not part of the stored record for a closed month.</div>
          </div>
          <div style={{ flex: '1 1 240px', minWidth: 240, borderLeft: '1px solid var(--border)', padding: '0 22px' }}>
            <div style={colHead(EXP)}>− Expenses &amp; Fees</div>
            <div style={grid2}>
              <span style={muted}>Expenses &amp; fees <span style={{ fontSize: '0.6rem' }}>(combined)</span></span><span style={{ color: EXP, fontWeight: 700, textAlign: 'right' }}>{minus(s.expensesCombined_p)}</span>
              <span style={{ color: 'var(--text)', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: 4 }}>Net Revenue</span><span style={{ color: '#7E57C2', fontWeight: 800, textAlign: 'right', borderTop: '1px solid var(--border)', paddingTop: 4 }}>{gbp(netRevenue)}</span>
            </div>
            <Note>Live copy "(combined)" reused from Finance.tsx. No Stripe fee line is added to a stored month.</Note>
          </div>
          <div style={{ flex: '1 1 190px', minWidth: 190, borderLeft: '1px solid var(--border)', padding: '0 22px' }}>
            <div style={colHead(OK)}>− Operating Costs</div>
            <div style={grid2}>
              <span style={muted}>Total wages</span><span style={{ color: OK, fontWeight: 700, textAlign: 'right' }}>{minus(s.wages_p)}</span>
              <span style={muted}>Fixed costs</span><span style={{ color: '#78909c', fontWeight: 700, textAlign: 'right' }}>{minus(s.fixed_p)}</span>
            </div>
          </div>
          <div style={{ flex: '1 1 190px', minWidth: 190, borderLeft: '1px solid var(--border)', paddingLeft: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={colHead('var(--muted)')}>= Net P&amp;L · {MONTHS[month]}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: netPL >= 0 ? OK : NEG, marginTop: 4 }}>{signed(netPL)}</div>
            <div style={{ fontSize: '0.68rem', ...muted, marginTop: 4 }}>Stored when the month was closed</div>
          </div>
        </div>
      </div>
      <ClosedMonthFacts month={month} />
    </>
  )
}

function ClosedMonthFacts({ month }: { month: string }) {
  const related = bookingsInMonth(ds, month)
  const noRecord = related.flatMap((b) => b.captures.filter((c) => monthOf(c.paidOn) === month && c.feeState === 'not_recorded'))
  const lateRefunds = ds.online.flatMap((b) => b.refunds.filter((r) => monthOf(b.serviceOn) === month && monthOf(r.refundedOn) > month).map((r) => ({ b, r })))
  return (
    <div id="closed" style={{ ...card, padding: '12px 18px', marginBottom: 14, borderRadius: 12, borderLeft: `3px solid ${WARN}` }}>
      <div style={{ ...colHead(WARN), fontSize: '0.6rem' }}>{MONTHS[month]} is closed</div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text)', marginTop: 6 }}>These figures were stored when the month was closed. Changes that arrive later are listed here and are not added to them.</div>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.72rem', lineHeight: 1.7, ...muted }}>
        {noRecord.length > 0 && <li>{plural(noRecord.length, 'website payment', 'website payments')} this month ({gbp(noRecord.reduce((s, c) => s + c.gross_p, 0))}) {noRecord.length === 1 ? 'has' : 'have'} <strong style={strong}>no Stripe fee record</strong> — taken before fee tracking began.</li>}
        {lateRefunds.map(({ b, r }) => (
          <li key={b.ref + r.refundedOn}>
            <strong style={strong}>Refund after closing:</strong> {b.ref} · {gbp(r.amount_p)} refunded on {dayLabel(r.refundedOn)} for a sale on {dayLabel(b.serviceOn)}. Not included in {MONTHS[month]}'s figures, and not included in {MONTHS[monthOf(r.refundedOn)] ?? 'the current month'}'s profit.
          </li>
        ))}
      </ul>
      <Note>A correction to a closed month is only possible through the existing super-admin post-close adjustment (FIN_PERIOD_CLOSE_DESIGN §8), shown as a prior-period memo. The prototype performs none and invents no rule for it.</Note>
    </div>
  )
}

// ── Review strip ─────────────────────────────────────────────────────────────

const REVIEW_TEXT: Record<ReviewItem['kind'], (i: ReviewItem) => ReactNode> = {
  SECOND_CAPTURE: (i) => <><strong style={strong}>Charged twice:</strong> {i.ref} was charged a second time ({gbp(i.amount_p)}) on {dayLabel(i.day)}. Finance counts the sale once. Check this payment in Stripe.</>,
  REFUND_AFTER_CHECKOUT: (i) => <><strong style={strong}>Refund after checkout:</strong> {i.ref} · {gbp(i.amount_p)} refunded on {dayLabel(i.day)}. The sale still shows its full amount in revenue.</>,
  REFUND_ON_CLOSED_MONTH_SALE: (i) => <><strong style={strong}>Refund for a closed month:</strong> {i.ref} · {gbp(i.amount_p)} refunded on {dayLabel(i.day)} for a sale in a closed month. It isn't included in that month's figures.</>,
}

function ReviewStrip({ month }: { month: string }) {
  const items = reviewItems(ds, month)
  if (items.length === 0) return null
  return (
    <div id="review" style={{ ...card, padding: '12px 18px', marginBottom: 14, borderRadius: 12, borderLeft: `3px solid ${NEG}` }}>
      <div style={{ ...colHead(NEG), fontSize: '0.6rem' }}>⚠ {plural(items.length, 'payment needs', 'payments need')} review</div>
      <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.72rem', lineHeight: 1.7, ...muted }}>
        {items.map((i) => <li key={i.ref + i.kind}>{REVIEW_TEXT[i.kind](i)}</li>)}
      </ul>
      <Note>The strip only raises items; nothing on this screen moves money and there is no automatic refund. Whether a refund should reduce a checked-out sale's revenue is an open decision.</Note>
    </div>
  )
}

// ── KPI cards ────────────────────────────────────────────────────────────────

function KpiCards({ month }: { month: string }) {
  const rev = monthRevenue(ds, month)
  const costs = ds.costs[month]
  const act = stripeActivity(ds, month)
  const cashInHand = rev.cash_p - costs.cashExpense_p - costs.cashPaid_p
  const bankBalance = rev.card_p + rev.online_p - costs.bankExpense_p - costs.bankPaid_p - rev.treatwellFee_p - costs.fixed_p
  const row = (label: ReactNode, value: ReactNode) => <><span style={muted}>{label}</span><span style={{ textAlign: 'right' }}>{value}</span></>
  const secondCaptured = ds.online.flatMap((b) => b.captures).filter((c) => c.second && monthOf(c.paidOn) === month).reduce((s, c) => s + c.gross_p, 0)
  return (
    <div id="kpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14, marginBottom: 26 }}>
      <div style={{ ...card, padding: '18px 20px', border: '2px solid rgba(76,175,80,0.4)', background: 'rgba(76,175,80,0.05)' }}>
        <div style={{ fontSize: '0.6rem', ...muted, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 8 }}>💵 CASH IN HAND</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: cashInHand >= 0 ? OK : NEG, marginBottom: 10 }}>{signed(cashInHand)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '0.72rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {row('Cash revenue', <span style={{ color: OK, fontWeight: 600 }}>+{gbp(rev.cash_p)}</span>)}
          {row('Cash expenses', <span style={{ color: EXP }}>{minus(costs.cashExpense_p)}</span>)}
          {row('Cash payments', <span style={{ color: EXP }}>{minus(costs.cashPaid_p)}</span>)}
        </div>
      </div>

      <div style={{ ...card, padding: '16px 20px', border: '2px solid rgba(83,74,183,0.4)', background: 'rgba(83,74,183,0.05)' }}>
        <div style={{ fontSize: '0.6rem', ...muted, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>🏦 BANK BALANCE</div>
        <div style={{ fontSize: '0.6rem', ...muted, marginBottom: 8 }}>(incl. rent/electric/rates)</div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: bankBalance >= 0 ? A : NEG, marginBottom: 10 }}>{signed(bankBalance)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: '0.72rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {row('Card/Monzo revenue', <span style={{ color: A, fontWeight: 600 }}>+{gbp(rev.card_p)}</span>)}
          {row(<span title="Settled before the visit through the booking rail. Reaches the bank via the provider's payout, before its fee.">Online (prepaid) revenue</span>, <span style={{ color: ONLINE, fontWeight: 600 }}>+{gbp(rev.online_p)}</span>)}
          {row('Bank expenses (paid)', <span style={{ color: EXP }}>{minus(costs.bankExpense_p)}</span>)}
          {row('Bank payments', <span style={{ color: EXP }}>{minus(costs.bankPaid_p)}</span>)}
          {row('Treatwell commission', <span style={{ color: FEE }}>{minus(rev.treatwellFee_p)}</span>)}
          {row('Fixed costs (accrued)', <span style={{ color: '#ff9800', fontStyle: 'italic' }}>{minus(costs.fixed_p)}</span>)}
        </div>
        <Note>This card is today's live card and formula, unchanged (online at gross, no Stripe fees). The draft does not change it until payout data exists.</Note>
      </div>

      <div style={{ ...card, padding: '16px 20px', border: '2px solid rgba(142,68,173,0.35)', background: 'rgba(142,68,173,0.04)' }}>
        <div style={{ fontSize: '0.6rem', ...muted, letterSpacing: '0.06em', fontWeight: 700, marginBottom: 4 }}>💳 ONLINE PAYMENTS · STRIPE</div>
        <div style={{ fontSize: '0.6rem', ...muted, marginBottom: 8 }}>by payment date · after fees and refunds</div>
        <div style={{ marginBottom: 10 }}><UpTo p={act.afterKnown_p} incomplete={!act.complete} color={ONLINE} size="1.6rem" /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', fontSize: '0.72rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {row(`Taken online · ${plural(act.captureCount, 'payment', 'payments')}`, <span style={{ color: ONLINE, fontWeight: 600 }}>+{gbp(act.captured_p)}</span>)}
          {row('Refunded', <span style={{ color: EXP }}>{minus(act.refunded_p)}</span>)}
          {row(`Stripe fees · ${act.knownCount} of ${act.captureCount} confirmed`, <span style={{ color: FEE }}>{minus(act.knownFee_p)}</span>)}
          {act.pendingCount > 0 && row(`${plural(act.pendingCount, 'fee', 'fees')} not yet confirmed (${gbp(act.pendingGross_p)} taken)`, <span style={muted}>not included</span>)}
          {act.notRecordedCount > 0 && row(`${plural(act.notRecordedCount, 'payment', 'payments')} with no fee record (${gbp(act.notRecordedGross_p)} taken)`, <span style={muted}>not included</span>)}
        </div>
        <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: '0.66rem', color: 'var(--text)', lineHeight: 1.5 }}>
          <strong>Not the same as money in your bank.</strong> <span style={muted}>Stripe payouts aren't tracked here yet, so some of this may still be with Stripe.</span>
          {secondCaptured > 0 && <div style={{ color: NEG, marginTop: 4 }}>Includes a duplicate charge of {gbp(secondCaptured)} that needs review.</div>}
        </div>
        <Note>New card proposed by the draft. Payment-date basis (provider view) is independent of the P&amp;L fee-day assumption. It is deliberately not merged into Bank Balance.</Note>
      </div>
    </div>
  )
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function Tabs({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  const tabBtn = (id: string, enabled = true): CSSProperties => ({ padding: '10px 4px', marginRight: 22, marginBottom: -1, background: 'transparent', border: 'none', borderBottom: `2.5px solid ${tab === id ? A : 'transparent'}`, fontSize: '0.76rem', fontWeight: tab === id ? 800 : 700, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: enabled ? 'pointer' : 'not-allowed', color: tab === id ? A : enabled ? 'var(--muted)' : 'var(--muted2)', fontFamily: 'inherit' })
  return (
    <div id="tabs">
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={tabBtn('daily')} onClick={() => setTab('daily')}>Daily Ledger</button>
        <button style={tabBtn('online')} onClick={() => setTab('online')}>Online payments</button>
        {['Tips', 'Payments', 'Expenses', 'Monthly Summary', 'Overview'].map((t) => (
          <button key={t} style={tabBtn(t, false)} disabled>{t}</button>
        ))}
      </div>
      <Note>"Online payments" is a new tab proposed by the draft. The other tabs exist in the live screen and are not part of this prototype.</Note>
    </div>
  )
}

function FeeCell({ known, pending, notRecorded, second }: { known: number; pending: number; notRecorded: number; second: boolean }) {
  const parts: ReactNode[] = []
  if (known > 0) parts.push(<span key="k" style={{ color: FEE, fontWeight: 700 }}>{minus(known)}{second ? ' ⚑' : ''}</span>)
  if (pending > 0) parts.push(<Tag key="p" tone="warn" title="Stripe hasn't confirmed this fee yet">awaiting Stripe{pending > 1 ? ` ×${pending}` : ''}</Tag>)
  if (notRecorded > 0) parts.push(<Tag key="n" tone="muted" title="Taken before fee tracking began — there is no fee record">no record{notRecorded > 1 ? ` ×${notRecorded}` : ''}</Tag>)
  if (parts.length === 0) return <span style={muted}>–</span>
  return <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>{parts}</span>
}

function DailyLedger({ month, assumption }: { month: string; assumption: FeeDayAssumption }) {
  if (ds.closedMonths[month]) {
    return (
      <div id="ledger" style={{ ...card, padding: '18px 20px', fontSize: '0.78rem', ...muted }}>
        {MONTHS[month]} is closed — see the stored figures above.
        <Note>Daily rows for a closed month are not part of this prototype.</Note>
      </div>
    )
  }
  const rows = dailyRows(ds, month, assumption)
  const cov = feeCoverage(ds, month, assumption)
  const t = rows.reduce((s, r) => ({ cash: s.cash + r.cash_p, card: s.card + r.card_p, online: s.online + r.online_p, tw: s.tw + r.treatwellFee_p, known: s.known + r.knownFee_p, pending: s.pending + r.pending, nr: s.nr + r.notRecorded, gross: s.gross + r.gross_p, net: s.net + r.netAfterKnown_p }), { cash: 0, card: 0, online: 0, tw: 0, known: 0, pending: 0, nr: 0, gross: 0, net: 0 })
  const incomplete = !coverageComplete(cov)
  return (
    <div id="ledger" style={{ ...card, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'rgba(83,74,183,0.07)' }}>
              <th style={{ ...thS, textAlign: 'left' }}>Date</th>
              <th style={thS}>Cash</th>
              <th style={thS}>Card</th>
              <th style={{ ...thS, color: ONLINE }} title="Settled before the visit through the booking rail — never at the desk">Online<br />prepaid</th>
              <th style={{ ...thS, color: FEE }}>Stripe<br />fee</th>
              <th style={{ ...thS, color: FEE }}>Treatwell<br />fee</th>
              <th style={{ ...thS, color: A }}>Gross</th>
              <th style={{ ...thS, color: '#7E57C2' }} title="Gross − platform fees known so far">Net after<br />fees</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day}>
                <td style={{ ...tdS(), textAlign: 'left', fontWeight: 700 }}>{dayLabel(r.day)}</td>
                <td style={tdS(r.cash_p ? OK : 'var(--muted)')}>{r.cash_p ? gbp(r.cash_p) : '–'}</td>
                <td style={tdS(r.card_p ? A : 'var(--muted)')}>{r.card_p ? gbp(r.card_p) : '–'}</td>
                <td style={tdS(r.online_p ? ONLINE : 'var(--muted)')}>{r.online_p ? gbp(r.online_p) : '–'}</td>
                <td style={tdS()}><FeeCell known={r.knownFee_p} pending={r.pending} notRecorded={r.notRecorded} second={r.secondCapture} /></td>
                <td style={tdS(r.treatwellFee_p ? FEE : 'var(--muted)')}>{r.treatwellFee_p ? minus(r.treatwellFee_p) : '–'}</td>
                <td style={tdS(A, true)}>{gbp(r.gross_p)}</td>
                <td style={tdS()}><UpTo p={r.netAfterKnown_p} incomplete={r.atMost} color="#7E57C2" /></td>
              </tr>
            ))}
            <tr style={{ background: 'rgba(83,74,183,0.05)' }}>
              <td style={{ ...tdS(undefined, true), textAlign: 'left' }}>Total</td>
              <td style={tdS(OK, true)}>{gbp(t.cash)}</td>
              <td style={tdS(A, true)}>{gbp(t.card)}</td>
              <td style={tdS(ONLINE, true)}>{gbp(t.online)}</td>
              <td style={tdS()}><FeeCell known={t.known} pending={t.pending} notRecorded={t.nr} second={false} /></td>
              <td style={tdS(FEE, true)}>{minus(t.tw)}</td>
              <td style={tdS(A, true)}>{gbp(t.gross)}</td>
              <td style={tdS()}><UpTo p={t.net} incomplete={incomplete} color="#7E57C2" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 14px', fontSize: '0.7rem', lineHeight: 1.7, ...muted }}>
        <div><strong style={strong}>Stripe fees this month:</strong> {cov.knownCount} of {cov.captures} confirmed
          {cov.pendingCount > 0 && ` · ${cov.pendingCount} awaiting Stripe (${gbp(cov.pendingGross_p)} taken)`}
          {cov.notRecordedCount > 0 && ` · ${cov.notRecordedCount} with no record (${gbp(cov.notRecordedGross_p)} taken)`}.
          {incomplete && ' Net is shown as "up to" until every fee is known.'}</div>
        {cov.outside.map((o) => (
          <div key={o.chargeRef}>
            {o.ref} · Stripe fee {o.fee_p !== null ? gbp(o.fee_p) : o.feeState === 'pending' ? 'awaiting Stripe' : 'with no record'} — {o.reason === 'no_service_day'
              ? 'booking cancelled and refunded, so this fee is not on any day.'
              : `belongs to ${MONTHS[o.month ?? ''] ?? o.month}, which is closed, so it is not included.`}
          </div>
        ))}
        {rows.some((r) => r.secondCapture) && <div>⚑ A duplicate charge on this day needs review.</div>}
      </div>
      <Note>
        The Stripe fee column is placed on the {assumption === 'service' ? 'checkout day (owner decision 2026-09-15)' : 'payment day (comparison view only)'}.
        Revenue columns are today's Finance and do not move with it. Per-day expense columns are omitted in the prototype.
        Where a fee on a cancelled, refunded booking should land is an open decision.
      </Note>
    </div>
  )
}

function AmountRow({ label, value, color, sub }: { label: ReactNode; value: ReactNode; color?: string; sub?: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 12px', padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: '0.76rem' }}>
      <span style={muted}>{label}{sub && <div style={{ fontSize: '0.64rem', marginTop: 2 }}>{sub}</div>}</span>
      <span style={{ textAlign: 'right', fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )
}

function PaymentCard({ b, assumption }: { b: OnlineBooking; assumption: FeeDayAssumption }) {
  const v = bookingView(b)
  const review = b.review === 'SECOND_CAPTURE'
  const closedSale = !!ds.closedMonths[monthOf(b.serviceOn)]
  const border = review ? NEG : v.refundKind !== 'none' ? EXP : v.atMost ? WARN : 'var(--border)'
  return (
    <div id={`card-${b.ref}`} style={{ ...card, padding: '14px 16px', borderLeft: `3px solid ${border}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text)' }}>{b.ref}</span>
        <span style={{ fontSize: '0.74rem', ...muted }}>{b.client} · {b.paymentType === 'DEPOSIT' ? 'deposit paid online' : 'paid in full online'}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {b.captures.every((c) => c.feeState === 'actual') && <Tag tone="ok">Fee confirmed</Tag>}
          {b.captures.some((c) => c.feeState === 'pending') && <Tag tone="warn">Awaiting Stripe fee</Tag>}
          {b.captures.some((c) => c.feeState === 'not_recorded') && <Tag tone="muted">No fee record</Tag>}
          {v.refundKind === 'partial' && <Tag tone="neg">Partly refunded</Tag>}
          {v.refundKind === 'full' && <Tag tone="neg">Refunded</Tag>}
          {review && <Tag tone="neg">Charged twice</Tag>}
          {closedSale && <Tag tone="muted">Sale in a closed month</Tag>}
        </span>
      </div>

      {b.captures.map((c, idx) => {
        const at = attributeCapture(b, c, assumption, ds)
        const where = at.kind === 'day' ? `Counted on ${dayLabel(at.day)}`
          : at.kind === 'no_service_day' ? 'Not counted on any day — booking cancelled'
          : `Belongs to ${MONTHS[monthOf(at.day)] ?? monthOf(at.day)}, which is closed — not included`
        const feeValue = c.feeState === 'actual' && c.fee_p !== null ? minus(c.fee_p)
          : c.feeState === 'pending' ? <Tag tone="warn">awaiting Stripe</Tag> : <Tag tone="muted">no record</Tag>
        const feeSub = c.feeState === 'pending' ? `${where}. Stripe hasn't confirmed this fee yet.`
          : c.feeState === 'not_recorded' ? `${where}. Taken before fee tracking began.` : where
        return (
          <div key={c.chargeRef}>
            <AmountRow label={<>{b.captures.length > 1 ? `Charge ${idx + 1}${c.second ? ' (duplicate)' : ''}` : 'Paid online'} · {dayLabel(c.paidOn)}</>} value={`+${gbp(c.gross_p)}`} color={c.second ? NEG : ONLINE} />
            <AmountRow label="Stripe fee" sub={feeSub} value={feeValue} color={FEE} />
          </div>
        )
      })}
      {b.refunds.map((r) => (
        <div key={r.refundedOn}>
          <AmountRow label={`Refunded · ${dayLabel(r.refundedOn)}`} value={minus(r.amount_p)} color={EXP} />
          <AmountRow label="Stripe fee returned" sub="Stripe keeps its processing fee when a payment is refunded" value="£0.00" color="var(--muted)" />
        </div>
      ))}
      <AmountRow
        label={<strong style={strong}>Net from this payment</strong>}
        sub={v.atMost ? 'May be lower once the Stripe fee is known' : 'After Stripe fees and refunds · not yet matched to a payout'}
        value={<UpTo p={v.afterFeeAndRefunds_p} incomplete={v.atMost} color={v.afterFeeAndRefunds_p < 0 ? NEG : ONLINE} />}
      />
      <div style={{ marginTop: 8, fontSize: '0.68rem', lineHeight: 1.6, ...muted }}>
        <div><strong style={strong}>In Finance revenue:</strong> {b.status === 'CHECKED_OUT'
          ? `${gbp(v.financeRevenue_p)} on ${dayLabel(b.serviceOn)} (online ${gbp(b.onlineLeg_p)}${b.deskCash_p ? ` + cash ${gbp(b.deskCash_p)}` : ''}${b.deskCard_p ? ` + card ${gbp(b.deskCard_p)}` : ''})${closedSale ? ' — in a closed month' : ''}`
          : 'nothing — booking cancelled'}</div>
        {v.refundKind !== 'none' && b.status === 'CHECKED_OUT' && <div style={{ color: WARN }}>The refund isn't deducted from this sale's revenue.</div>}
        {review && <div style={{ color: NEG }}>{gbp(v.gross_p)} was taken but Finance counts {gbp(b.onlineLeg_p)}. Check the duplicate charge in Stripe.</div>}
      </div>
      <Note>
        {b.scenario}.
        {b.refunds.length > 0 && ' Refund rows are read from Stripe here; a real ledger entry needs B1b.'}
        {v.refundKind !== 'none' && b.status === 'CHECKED_OUT' && ' Revenue is not reduced because today\'s Finance does not read refunds — the product decision is open.'}
        {review && ' No automatic refund; resolution is a separate manual step.'}
        {b.captures.some((c) => attributeCapture(b, c, assumption, ds).kind !== 'day') && ' A fee with no checkout day (cancelled booking) or in a closed month is not placed on any day — where it should go is still open.'}
      </Note>
    </div>
  )
}

function OnlinePayments({ month, assumption, only }: { month: string; assumption: FeeDayAssumption; only: string[] }) {
  const list = bookingsInMonth(ds, month).filter((b) => only.length === 0 || only.includes(b.ref))
  return (
    <div>
      <div style={{ fontSize: '0.7rem', ...muted, marginBottom: 10 }}>
        Website bookings with a payment, service or refund in {MONTHS[month]}.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 14 }}>
        {list.map((b) => <PaymentCard key={b.ref} b={b} assumption={assumption} />)}
      </div>
    </div>
  )
}

// ── App ──────────────────────────────────────────────────────────────────────

function readParam(name: string, allowed: string[] | null, fallback: string): string {
  const v = new URLSearchParams(window.location.search).get(name)
  if (!v) return fallback
  return allowed === null || allowed.includes(v) ? v : fallback
}

export function App() {
  const [month, setMonth] = useState(() => readParam('month', MONTH_KEYS, '2026-09'))
  const [tab, setTab] = useState(() => readParam('tab', ['daily', 'online'], 'daily'))
  const [assumption, setAssumption] = useState<FeeDayAssumption>(() => readParam('fee', ['service', 'payment'], 'service') as FeeDayAssumption)
  const [theme, setTheme] = useState(() => readParam('theme', ['light', 'dark'], 'light'))
  const [notes, setNotes] = useState(() => readParam('notes', ['0', '1'], '0') === '1')
  // Review aids only (not product): show a subset of cards, scroll a section into view.
  const [only] = useState(() => readParam('only', null, '').split(',').map((s) => s.trim()).filter(Boolean))
  const [focus] = useState(() => readParam('focus', null, ''))

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme) }, [theme])
  useEffect(() => {
    const q = new URLSearchParams({ month, tab, fee: assumption, theme, notes: notes ? '1' : '0' })
    if (only.length) q.set('only', only.join(','))
    if (focus) q.set('focus', focus)
    window.history.replaceState(null, '', `?${q.toString()}`)
  }, [month, tab, assumption, theme, notes, only, focus])
  useEffect(() => {
    if (!focus) return
    const t = window.setTimeout(() => document.getElementById(focus)?.scrollIntoView({ block: 'start' }), 80)
    return () => window.clearTimeout(t)
  }, [focus])

  const closed = !!ds.closedMonths[month]

  return (
    <NotesOn.Provider value={notes}>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: FONT, color: 'var(--text)' }}>
        <PrototypeBar assumption={assumption} setAssumption={setAssumption} notes={notes} setNotes={setNotes} theme={theme} setTheme={setTheme} />
        <div style={{ maxWidth: 1320, margin: '0 auto', padding: '20px 20px 60px' }}>
          <Header month={month} setMonth={setMonth} />
          <AssumptionNotes assumption={assumption} />
          {closed ? <ClosedMonthWaterfall month={month} /> : <OpenMonthWaterfall month={month} assumption={assumption} />}
          <ReviewStrip month={month} />
          {!closed && <KpiCards month={month} />}
          <Tabs tab={tab} setTab={setTab} />
          {tab === 'daily' ? <DailyLedger month={month} assumption={assumption} /> : <OnlinePayments month={month} assumption={assumption} only={only} />}
        </div>
      </div>
    </NotesOn.Provider>
  )
}
