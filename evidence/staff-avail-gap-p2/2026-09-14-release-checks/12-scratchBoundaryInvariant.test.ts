// SCRATCH-ONLY (never committed; lives in the rehearsal copy, not the repo or the release clone).
// Re-expresses src/staff/lib/staffPostWriteBoundary.test.ts' failing WalkInFlow assertion for the
// 9ea0aca structure, to separate "stale count" from "broken invariant". Same source text, same rule:
// no create / checkout / package-link / product-sale call may sit inside a post-write step.
import { describe, it, expect } from 'vitest'
import walkInFlowSrc from '../sheets/WalkInFlow.tsx?raw'

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n')
const wf = strip(walkInFlowSrc)

describe('WalkInFlow @9ea0aca — the post-write boundary invariant, adapted to createWalkInEnforced', () => {
  it('the ORIGINAL assertion fails only on its count: exactly one awaited createSaleBooking now', () => {
    expect(wf.match(/await createSaleBooking\(/g) || []).toHaveLength(1)
  })
  it('that one awaited createSaleBooking (and the override resubmission) live inside createWalkInEnforced', () => {
    const start = wf.indexOf('async function createWalkInEnforced')
    const end = wf.indexOf('const reportPresentationIssue', start)
    const body = wf.slice(start, end)
    expect(body).toContain('return await createSaleBooking(time)')
    expect(body).toContain('submit: (override) => createSaleBooking(time, override)')
    const outside = wf.slice(0, start) + wf.slice(end)
    expect((outside.match(/createSaleBooking\(/g) || []).length).toBe(1) // its own declaration only
    expect(outside).toMatch(/async function createSaleBooking\(/)
  })
  it('save + pay each create exactly once through the enforced step; checkout exactly once', () => {
    expect(wf.match(/await createWalkInEnforced\(/g) || []).toHaveLength(2)
    expect(wf.match(/await checkoutBooking\(/g) || []).toHaveLength(1)
  })
  it('no post-write step contains a create, checkout, package link or product sale', () => {
    let blocks = 0
    for (const m of wf.matchAll(/afterWriteSucceeded\([\s\S]{0,400}?\n\s*\)/g)) {
      blocks++
      for (const forbidden of ['createSaleBooking(', 'createWalkInEnforced(', 'checkoutBooking(', 'callSalownCreateStaffProductSale(', 'linkBookingToPackage(']) {
        expect(m[0]).not.toContain(forbidden)
      }
    }
    expect(blocks).toBeGreaterThanOrEqual(3)
  })
})
