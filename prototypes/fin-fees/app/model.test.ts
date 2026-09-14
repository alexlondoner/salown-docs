import { describe, expect, it } from 'vitest'
import { DATASET as ds } from './data'
import {
  bookingView, coverageComplete, dailyRows, feeCoverage, monthRevenue, reviewItems, stripeActivity,
} from './model'

describe('FIN-FEES prototype model (synthetic data)', () => {
  it('never counts an unknown fee as zero, and reports the missing coverage', () => {
    const c = feeCoverage(ds, '2026-09', 'service')
    expect(c.known_p).toBe(339)
    expect(c.knownCount).toBe(5)
    expect(c.pendingCount).toBe(1)
    expect(c.notRecordedCount).toBe(2)
    expect(c.notRecordedGross_p).toBe(3800)
    expect(c.outside.map((o) => o.ref)).toEqual(['W-07'])
    expect(coverageComplete(c)).toBe(false)
  })

  it('revenue is identical under both fee-day assumptions and ignores fees and refunds', () => {
    const r = monthRevenue(ds, '2026-09')
    expect(r.online_p).toBe(19700)
    expect(r.gross_p).toBe(r.cash_p + r.card_p + r.online_p)
    const sumRows = (a: 'service' | 'payment') => dailyRows(ds, '2026-09', a).reduce((s, x) => s + x.gross_p, 0)
    expect(sumRows('service')).toBe(r.gross_p)
    expect(sumRows('payment')).toBe(r.gross_p)
  })

  it('payment-day assumption moves a fee into a closed month as an outside item, never into its figures', () => {
    const c = feeCoverage(ds, '2026-09', 'payment')
    expect(c.known_p).toBe(407)
    expect(c.outside).toEqual([expect.objectContaining({ ref: 'W-05', reason: 'closed_month', month: '2026-08' })])
  })

  it('Stripe activity is an upper bound while any fee is unknown', () => {
    const a = stripeActivity(ds, '2026-09')
    expect(a.captured_p).toBe(25100)
    expect(a.refunded_p).toBe(5700)
    expect(a.knownFee_p).toBe(407)
    expect(a.afterKnown_p).toBe(18993)
    expect(a.complete).toBe(false)
  })

  it('a cancelled, fully refunded booking has no revenue and keeps its fee', () => {
    const w07 = ds.online.find((b) => b.ref === 'W-07')!
    const v = bookingView(w07)
    expect(v.financeRevenue_p).toBe(0)
    expect(v.refundKind).toBe('full')
    expect(v.afterFeeAndRefunds_p).toBe(-68)
  })

  it('raises refunds on checked-out sales and second captures for review, without deciding them', () => {
    expect(reviewItems(ds, '2026-09').map((i) => `${i.ref}:${i.kind}`)).toEqual([
      'W-09:REFUND_ON_CLOSED_MONTH_SALE',
      'W-06:REFUND_AFTER_CHECKOUT',
      'W-08:SECOND_CAPTURE',
    ])
  })
})
