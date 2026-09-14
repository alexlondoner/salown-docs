// SYNTHETIC DATA — invented for the local FIN-FEES prototype. No real booking,
// client, amount or Stripe object is represented. Fee amounts are illustrative
// and are NOT Stripe's price list. Integer pence throughout.
import type { Dataset } from './model'

export const DATASET: Dataset = {
  asOf: '2026-09-14T16:00:00Z',
  ledgerStart: '2026-09-05T09:00:00Z',
  closedMonths: {
    '2026-08': { gross_p: 1024060, expensesCombined_p: 101240, wages_p: 560000, fixed_p: 312000 },
  },
  desk: [
    { day: '2026-09-01', cash_p: 18400, card_p: 26500 },
    { day: '2026-09-02', cash_p: 15200, card_p: 31800 },
    { day: '2026-09-03', cash_p: 21000, card_p: 28400 },
    { day: '2026-09-04', cash_p: 16800, card_p: 35200 },
    { day: '2026-09-05', cash_p: 24600, card_p: 41200 },
    { day: '2026-09-07', cash_p: 12800, card_p: 19400 },
    { day: '2026-09-08', cash_p: 17600, card_p: 27300 },
    { day: '2026-09-09', cash_p: 19800, card_p: 30100 },
    { day: '2026-09-10', cash_p: 14400, card_p: 26900 },
    { day: '2026-09-11', cash_p: 22300, card_p: 38800 },
    { day: '2026-09-12', cash_p: 26100, card_p: 44700 },
    { day: '2026-09-14', cash_p: 9800, card_p: 15600 },
  ],
  treatwell: [
    { day: '2026-09-05', card_p: 3000, twFee_p: 945 },
  ],
  online: [
    {
      ref: 'W-01', client: 'Client A', scenario: 'Fee known — full online payment',
      status: 'CHECKED_OUT', serviceOn: '2026-09-09', paymentType: 'FULL',
      onlineLeg_p: 4000, deskCash_p: 0, deskCard_p: 0,
      captures: [{ chargeRef: 'ch_synthetic_01', paidOn: '2026-09-06', gross_p: 4000, fee_p: 80, feeState: 'actual' }],
      refunds: [],
    },
    {
      ref: 'W-02', client: 'Client B', scenario: 'Fee known — deposit online, remainder at the desk',
      status: 'CHECKED_OUT', serviceOn: '2026-09-10', paymentType: 'DEPOSIT',
      onlineLeg_p: 1000, deskCash_p: 0, deskCard_p: 2200,
      captures: [{ chargeRef: 'ch_synthetic_02', paidOn: '2026-09-07', gross_p: 1000, fee_p: 35, feeState: 'actual' }],
      refunds: [],
    },
    {
      ref: 'W-03', client: 'Client C', scenario: 'Fee pending — Stripe has not priced it yet',
      status: 'CHECKED_OUT', serviceOn: '2026-09-14', paymentType: 'FULL',
      onlineLeg_p: 3200, deskCash_p: 0, deskCard_p: 0,
      captures: [{ chargeRef: 'ch_synthetic_03', paidOn: '2026-09-14', gross_p: 3200, fee_p: null, feeState: 'pending' }],
      refunds: [],
    },
    {
      ref: 'W-04', client: 'Client D', scenario: 'No fee record — paid before fee tracking started',
      status: 'CHECKED_OUT', serviceOn: '2026-09-03', paymentType: 'FULL',
      onlineLeg_p: 2800, deskCash_p: 0, deskCard_p: 0,
      captures: [{ chargeRef: 'ch_synthetic_04', paidOn: '2026-09-01', gross_p: 2800, fee_p: null, feeState: 'not_recorded' }],
      refunds: [],
    },
    {
      ref: 'W-05', client: 'Client E', scenario: 'No fee record — deposit paid in a closed month, service in this month',
      status: 'CHECKED_OUT', serviceOn: '2026-09-04', paymentType: 'DEPOSIT',
      onlineLeg_p: 1000, deskCash_p: 2000, deskCard_p: 0,
      captures: [{ chargeRef: 'ch_synthetic_05', paidOn: '2026-08-28', gross_p: 1000, fee_p: null, feeState: 'not_recorded' }],
      refunds: [],
    },
    {
      ref: 'W-06', client: 'Client F', scenario: 'Partial refund after checkout — fee not returned',
      status: 'CHECKED_OUT', serviceOn: '2026-09-11', paymentType: 'FULL',
      onlineLeg_p: 4500, deskCash_p: 0, deskCard_p: 0,
      captures: [{ chargeRef: 'ch_synthetic_06', paidOn: '2026-09-08', gross_p: 4500, fee_p: 88, feeState: 'actual' }],
      refunds: [{ refundedOn: '2026-09-12', amount_p: 1500 }],
    },
    {
      ref: 'W-07', client: 'Client G', scenario: 'Full refund — cancelled, never checked out, fee not returned',
      status: 'CANCELLED', serviceOn: '2026-09-15', paymentType: 'FULL',
      onlineLeg_p: 0, deskCash_p: 0, deskCard_p: 0,
      captures: [{ chargeRef: 'ch_synthetic_07', paidOn: '2026-09-09', gross_p: 3200, fee_p: 68, feeState: 'actual' }],
      refunds: [{ refundedOn: '2026-09-10', amount_p: 3200 }],
    },
    {
      ref: 'W-08', client: 'Client H', scenario: 'Second capture — charged twice, needs review',
      status: 'CHECKED_OUT', serviceOn: '2026-09-12', paymentType: 'FULL',
      onlineLeg_p: 3200, deskCash_p: 0, deskCard_p: 0,
      captures: [
        { chargeRef: 'ch_synthetic_08a', paidOn: '2026-09-12', gross_p: 3200, fee_p: 68, feeState: 'actual' },
        { chargeRef: 'ch_synthetic_08b', paidOn: '2026-09-12', gross_p: 3200, fee_p: 68, feeState: 'actual', second: true },
      ],
      refunds: [],
      review: 'SECOND_CAPTURE',
    },
    {
      ref: 'W-09', client: 'Client I', scenario: 'Refund in this month on a sale in a closed month',
      status: 'CHECKED_OUT', serviceOn: '2026-08-29', paymentType: 'DEPOSIT',
      onlineLeg_p: 1000, deskCash_p: 0, deskCard_p: 2500,
      captures: [{ chargeRef: 'ch_synthetic_09', paidOn: '2026-08-27', gross_p: 1000, fee_p: null, feeState: 'not_recorded' }],
      refunds: [{ refundedOn: '2026-09-03', amount_p: 1000 }],
    },
  ],
  costs: {
    '2026-09': { cashExpense_p: 41200, bankExpense_p: 23650, bankPaid_p: 90000, cashPaid_p: 120000, wages_p: 360000, fixed_p: 144000 },
  },
}
