# LEGAL_TERMS_DRAFT.md — salOWN Terms of Service (DRAFT, not yet published)

> **Status: DRAFT · LEG-1 · GTM gate A1.** Written 2026-09-07 from the codebase and the
> roadmap, not from a template pack. **Not legal advice.** Before it goes to `hosting/terms.html`
> it needs (1) the owner to fill every `[BRACKETED]` field, (2) a solicitor's read for England &
> Wales, (3) the pricing decision (§9.1 #9). Facts marked ✅ were checked against the code on the
> day of writing; anything the product changes must change here first.
>
> Publishing path when ready: static page under `salown-app/hosting/` + landing footer link
> (`hosting/index.html:652-653` are `href="#"` today). Touching `hosting/**` on `main` triggers the
> Admin-site CI deploy — publish as its own owner-approved release, not folded into another push.

---

## Owner inputs required before publication

| Field | Value |
|---|---|
| Legal entity operating salOWN | `[LEGAL ENTITY NAME]` — sole trader / Ltd? |
| Company number (if Ltd) | `[COMPANY NUMBER]` |
| Registered / trading address | `[REGISTERED ADDRESS]` |
| Contact email for legal notices | `info@salown.com` ✅ (the only human-read address; `noreply@` is outbound only) |
| Governing law | England and Wales (assumed — confirm) |
| Plans and prices | `[STARTER / PRO / PRO+ PRICES]` — landing shows none today, deliberately |
| Trial length | `[TRIAL DAYS]` — `status: trial` exists on tenant documents ✅; the length is not fixed in code |
| Effective date | `[DATE]` |

---

# salOWN Terms of Service

**Effective:** `[DATE]` · **Operator:** `[LEGAL ENTITY NAME]` (`[COMPANY NUMBER]`), `[REGISTERED ADDRESS]` ("salOWN", "we", "us").

These Terms govern the use of the salOWN salon operating system at salown.com, staff.salown.com,
the hosted booking pages at salown.com/book and salown.com/s, and any premium website we host for a
salon (together, the "Service"). By creating an account or using the Service you agree to them.

## 1. Who the Service is for

1.1 The Service is provided to businesses (salons, barbers, clinics and similar) and the people
who work for them. It is not offered to consumers. The business that opens an account is the
"Customer"; every user account under it belongs to the Customer.

1.2 The person opening an account confirms they are authorised to bind the Customer.

1.3 Members of the public who book an appointment through a salon's booking page are the salon's
customers, not ours. Their relationship is with the salon; our Privacy Policy explains what we do
with their data on the salon's behalf.

## 2. Accounts and access

2.1 Accounts are opened either by invitation after an application, or through self-registration
at salown.com/signup. ✅ Both paths exist and remain open.

2.2 The Customer is responsible for everything done under its accounts, for keeping credentials
confidential, and for removing access when a staff member leaves. The Service provides owner,
admin and staff roles with different permissions ✅; the Customer chooses who holds which.

2.3 We may suspend an account that we reasonably believe is compromised or is being used in breach
of these Terms, and will tell the Customer as soon as practicable.

## 3. What the Service does — and does not — do

3.1 The Service records appointments, walk-ins, checkouts, staff rotas, client records, loyalty,
campaigns and finance summaries, and can receive booking notifications forwarded from third-party
marketplaces (for example Treatwell, Booksy, Fresha) by e-mail parsing. ✅

3.2 **Parsed bookings are best-effort.** A booking created from a forwarded e-mail depends on the
format that marketplace sends. We do not guarantee that every forwarded e-mail is parsed, or parsed
correctly, and the Customer remains responsible for checking its diary against the marketplace.

3.3 **One-way calendar feed.** Where the Service publishes an iCal feed, it is outbound only. The
Service does not block or edit slots inside a third-party marketplace. ✅

3.4 **Finance figures are records, not accounts.** Sales, wage and profit/loss views are produced
from what the Customer's staff enter at the till and in Team Members. They are not a substitute for
bookkeeping or statutory accounts and must not be relied on as such.

3.5 **AI features** answer questions about the Customer's own data. Answers may be wrong; they
are not advice. ✅ The assistant only receives data the asking user can already see.

3.6 We may change, add or retire features. Where a change removes something the Customer relies
on, we will give reasonable notice.

## 4. Payments taken through the Service

4.1 Where a salon enables online deposits or payments, the money is processed by Stripe under the
salon's own Stripe account (Stripe Connect) or, for a premium website, under an account the salon
holds directly. **salOWN does not hold client funds.** ✅ (Today this capability is in test mode
and takes no real money; this clause applies from the day it is switched on.)

4.2 Refunds, deposits, no-show charges and cancellation rules are the salon's policy and the
salon's responsibility. The Service records and, where configured, automates them.

## 5. Fees, plans and trials

5.1 Plans, limits and prices are as published at `[PRICING PAGE / QUOTE]`. `[TRIAL DAYS]`-day
trials convert to a paid plan unless cancelled before the trial ends.

5.2 Plan limits (for example the number of team members) are enforced softly today ✅; we may
enforce them strictly on notice.

5.3 Fees are invoiced `[MONTHLY / ANNUALLY]` in GBP, exclusive of VAT where applicable. Late
payment may lead to suspension after 14 days' written notice.

5.4 Premium website hosting, custom domains and SEO packages are quoted separately.

## 6. The Customer's data

6.1 The Customer owns its business data and the personal data of its clients. We process client
data only on the Customer's instructions, as set out in the Data Processing Terms in Schedule 1,
which form part of these Terms.

6.2 The Customer is responsible for having a lawful basis to record its clients' details, for its
own privacy notice, and for marketing consent where it uses the campaign features. The Service
honours unsubscribes ✅ and will not send marketing e-mail to a client who has opted out.

6.3 On termination, the Customer may export its data on request within 30 days; after that we
delete or anonymise it, except where the law requires longer retention.

## 7. Acceptable use

The Customer must not: use the Service to send unsolicited marketing; upload content that is
unlawful or infringes anyone's rights; attempt to access another salon's data; reverse-engineer,
scrape or overload the Service; or resell it without a written agreement.

## 8. Availability and support

8.1 We aim for the Service to be available at all times but do not guarantee uninterrupted
operation. Planned maintenance will be announced where practicable. Support is by e-mail at
info@salown.com during UK business hours.

8.2 The Customer should keep its own record of the day's appointments sufficient to operate if the
Service is unavailable.

## 9. Intellectual property

The Service, its software and branding belong to us or our licensors. The Customer receives a
non-exclusive, non-transferable right to use it for its own business while the account is active.
The Customer keeps all rights in its own content and data.

## 10. Liability

10.1 Nothing in these Terms limits liability for death or personal injury caused by negligence,
fraud, or anything that cannot be limited by law.

10.2 Subject to 10.1, we are not liable for loss of profit, revenue, goodwill or data, or for
indirect or consequential loss, and our total liability in any 12-month period is limited to the
fees paid by the Customer for the Service in that period.

10.3 We are not liable for the acts of third-party marketplaces, payment processors or
messaging providers, or for a booking that a marketplace failed to send us.

## 11. Term and termination

11.1 These Terms apply while the Customer has an account. Either party may end the agreement on
30 days' written notice. We may end it immediately for material breach not remedied within 14 days
of notice, or for non-payment under 5.3.

11.2 Sections 6.3, 9, 10, 12 and 13 survive termination.

## 12. Changes to these Terms

We may update these Terms. Material changes will be notified by e-mail to the account owner at
least 14 days before they take effect. Continued use after that date is acceptance.

## 13. General

13.1 These Terms are governed by the law of England and Wales and the courts of England and Wales
have exclusive jurisdiction.

13.2 If any clause is unenforceable the rest remain in force. Neither party may assign these Terms
without consent, except that we may assign to a successor of the business.

13.3 Notices to us: info@salown.com and `[REGISTERED ADDRESS]`. Notices to the Customer: the
owner e-mail on the account.

---

## Schedule 1 — Data Processing Terms (summary; full DPA available on request)

| Item | Detail |
|---|---|
| Roles | Customer = controller of its clients' data. salOWN = processor. For Customer account and billing data, salOWN = controller (see Privacy Policy). |
| Subject matter | Salon operations: appointments, client records, staff records, sales, marketing. |
| Duration | Life of the account plus the 30-day export window in 6.3. |
| Data subjects | The Customer's clients, staff and users. |
| Categories | Name, phone, e-mail, appointment history, spend, notes the salon records, loyalty balance; staff names, hours and pay parameters. No special-category data is required by the Service; the Customer must not record it in free-text notes. |
| Instructions | Processing only as needed to provide the Service and as configured by the Customer. |
| Sub-processors | Listed in the Privacy Policy §7. Changes notified 14 days in advance; the Customer may object on reasonable grounds. |
| Security | Tenant isolation enforced at the database rules layer ✅; role-based access ✅; data held in Google Cloud `europe-west2` (London) ✅; encryption in transit and at rest by the platform. |
| Assistance | We help the Customer answer data-subject requests and breach notifications within the statutory windows. |
| Breach | Notification to the Customer without undue delay after we become aware. |
| Deletion | Per 6.3. |
| Audit | Written information on request; on-site audit by agreement, at the Customer's cost, no more than annually. |
