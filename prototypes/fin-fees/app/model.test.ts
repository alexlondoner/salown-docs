import { describe, expect, it } from 'vitest'
import { DATASET as ds } from './data'
import {
  attributeCapture, bookingView, coverageComplete, dailyRows, feeCoverage, monthRevenue, reviewItems, stripeActivity,
} from './model'

const booking = (ref: string) => ds.online.find((b) => b.ref === ref)!

describe('FIN-FEES prototype model (synthetic data)', () => {
  it('never counts an unknown fee as zero, and reports the missing coverage', () => {
    const c = feeCoverage(ds, '2026-09', 'checkout')
    expect(c.known_p).toBe(399)
    expect(c.knownCount).toBe(6)
    expect(c.captures).toBe(9)
    expect(c.pendingCount).toBe(1)
    expect(c.notRecordedCount).toBe(2)
    expect(c.notRecordedGross_p).toBe(3800)
    expect(c.outside.map((o) => `${o.ref}:${o.reason}`)).toEqual(['W-07:no_checkout', 'W-11:checkout_time_missing'])
    expect(coverageComplete(c)).toBe(false)
  })

  it('revenue is identical under both fee-day views and ignores fees and refunds', () => {
    const r = monthRevenue(ds, '2026-09')
    expect(r.online_p).toBe(25200)
    expect(r.gross_p).toBe(r.cash_p + r.card_p + r.online_p)
    const sumRows = (a: 'checkout' | 'payment') => dailyRows(ds, '2026-09', a).reduce((s, x) => s + x.gross_p, 0)
    expect(sumRows('checkout')).toBe(r.gross_p)
    expect(sumRows('payment')).toBe(r.gross_p)
  })

  it('places the fee on the checkout day, not the appointment day, and leaves revenue on the appointment day', () => {
    const rows = dailyRows(ds, '2026-09', 'checkout')
    const day = (d: string) => rows.find((r) => r.day === d)!
    expect(attributeCapture(booking('W-10'), booking('W-10').captures[0], 'checkout', ds)).toEqual({ kind: 'day', day: '2026-09-11' })
    expect(day('2026-09-10').online_p).toBe(4000) // W-02 1000 + W-10 3000 revenue on the appointment day
    expect(day('2026-09-10').knownFee_p).toBe(35) // only W-02's fee
    expect(day('2026-09-11').knownFee_p).toBe(148) // W-06 88 + W-10 60 on the checkout day
  })

  it('does not fall back to another date when the checkout time is missing', () => {
    const w11 = booking('W-11')
    expect(attributeCapture(w11, w11.captures[0], 'checkout', ds)).toEqual({ kind: 'checkout_time_missing' })
    const placed = dailyRows(ds, '2026-09', 'checkout').reduce((s, r) => s + r.knownFee_p, 0)
    expect(placed).toBe(399) // W-11's 75 is in no row: not on its appointment day, not on its payment day
  })

  it('gives no date to the fee of a booking that was never checked out', () => {
    const w07 = booking('W-07')
    expect(attributeCapture(w07, w07.captures[0], 'checkout', ds)).toEqual({ kind: 'no_checkout' })
    const v = bookingView(w07)
    expect(v.financeRevenue_p).toBe(0)
    expect(v.refundKind).toBe('full')
    expect(v.afterFeeAndRefunds_p).toBe(-68)
  })

  it('never adds a fee to a closed month; the payment-day comparison view lists it instead', () => {
    const c = feeCoverage(ds, '2026-09', 'payment')
    expect(c.known_p).toBe(542)
    expect(c.outside).toEqual([expect.objectContaining({ ref: 'W-05', reason: 'closed_month', month: '2026-08' })])
  })

  it('Stripe activity is an upper bound while any fee is unknown', () => {
    const a = stripeActivity(ds, '2026-09')
    expect(a.captured_p).toBe(30600)
    expect(a.refunded_p).toBe(5700)
    expect(a.knownFee_p).toBe(542)
    expect(a.afterKnown_p).toBe(24358)
    expect(a.complete).toBe(false)
  })

  it('raises refunds, second captures and missing checkout times for review, without deciding them', () => {
    expect(reviewItems(ds, '2026-09').map((i) => `${i.ref}:${i.kind}`)).toEqual([
      'W-09:REFUND_ON_CLOSED_MONTH_SALE',
      'W-11:FEE_DAY_UNRESOLVED',
      'W-06:REFUND_AFTER_CHECKOUT',
      'W-08:SECOND_CAPTURE',
    ])
  })
})
