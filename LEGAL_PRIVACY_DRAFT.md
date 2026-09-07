# LEGAL_PRIVACY_DRAFT.md — salOWN Privacy Policy (DRAFT, not yet published)

> **Status: DRAFT · LEG-1 · GTM gate A1.** Same caveats as [LEGAL_TERMS_DRAFT.md](LEGAL_TERMS_DRAFT.md):
> owner fills the `[BRACKETED]` fields, a solicitor reads it, then it ships as
> `hosting/privacy.html` in its own release. Every ✅ was checked against the code on 2026-09-07.
> The sub-processor table in §7 is the part most likely to rot — it must be edited whenever a
> provider is added (WhatsApp/Meta is listed as *planned* because B7 is not live).

---

## Owner inputs required before publication

| Field | Value |
|---|---|
| Controller name and address | `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]` |
| ICO registration number | `[ICO NUMBER]` — most UK businesses processing client data must register and pay the data protection fee |
| Contact for privacy requests | `info@salown.com` ✅ |
| Effective date | `[DATE]` |

---

# salOWN Privacy Policy

**Effective:** `[DATE]` · **Controller:** `[LEGAL ENTITY NAME]`, `[REGISTERED ADDRESS]` · **Contact:** info@salown.com

salOWN is a salon operating system used by salons and their staff. This policy explains what
personal data we handle, in which role, and what your rights are. It covers salown.com,
staff.salown.com, the hosted booking pages, and premium websites we host for salons.

## 1. Two roles — read the one that applies to you

**If you are a salon (our Customer) or one of its staff:** for your account, login, billing and
support data we are the **controller**. Sections 2–3 apply.

**If you booked an appointment with a salon that uses salOWN:** the **salon is the controller**
of your data and we are its **processor**. Section 4 applies. Privacy requests about your booking
go to the salon first; we will help them answer.

**If you are visiting salown.com:** Section 5 applies.

## 2. Salons and staff — what we collect and why

| Data | Why | Lawful basis |
|---|---|---|
| Owner and staff name, e-mail, role, login records | Operate the account; enforce who can see what ✅ | Contract |
| Salon name, address, opening hours, services, prices | Publish your booking page and run the diary | Contract |
| Staff working days, hours, pay parameters entered by the owner | Rotas, wage and profit/loss views the owner configures | Contract (the owner's), legitimate interest (ours: providing the feature) |
| Billing contact and plan | Invoicing | Contract, legal obligation (tax records) |
| Support correspondence | Answer you | Legitimate interest |
| Product usage (which screens, errors) | Keep the Service working and improve it | Legitimate interest |

We do not sell this data and do not use it to advertise to you.

## 3. Salons and staff — how long

Account data is kept while the account is open and for 30 days after closure to allow export,
then deleted or anonymised. Invoices are kept for 6 years (UK tax law). Support e-mails are
kept for 2 years.

## 4. Salon clients — what we process on the salon's behalf

When you book with a salon that uses salOWN, or the salon records you as a client, we process on
the salon's instructions:

- name, phone number, e-mail address;
- appointment date, time, service, staff member, price, and payment/deposit status;
- whether you attended, cancelled or did not show;
- loyalty points and spend history;
- notes the salon chooses to record;
- if the salon forwards its marketplace booking e-mails to us (Treatwell, Booksy, Fresha), the
  booking details contained in those e-mails ✅;
- e-mail delivery events (sent, opened, bounced, unsubscribed) for confirmations and reminders ✅;
- where a salon has enabled it, WhatsApp delivery status for booking confirmations *(planned —
  not live at the date of this policy)*.

**Payments.** Card details never reach salOWN. Online deposits and payments are taken by Stripe
under the salon's own Stripe account; we receive only the amount, status and a reference. ✅

**Marketing.** A salon may send you campaign e-mails through salOWN. Every such e-mail carries an
unsubscribe link; opting out is recorded immediately and is honoured by every later campaign. ✅
Whether the salon had a lawful basis to e-mail you is the salon's responsibility.

**Manage your booking.** Confirmation e-mails carry a "Manage booking" link that lets you cancel
or reschedule without an account. ✅ Access is gated by the e-mail address the booking was made with.

**Retention.** We keep client data for as long as the salon keeps its account, under the salon's
instructions. When a salon leaves, its clients' data goes with it (§3).

## 5. Visitors to salown.com

The landing site sets **no analytics cookies unless you click Accept** on the cookie banner. If
you accept, Google Analytics 4 loads with IP anonymisation; if you decline, nothing loads and
nothing leaves your browser. Your choice is stored in your browser only. ✅

The landing page's chat assistant sends what you type to our AI provider (§7) to generate a
reply. Do not enter personal data you would not want processed for that purpose.

If you apply for early access, we keep your name, salon name, e-mail and phone to contact you
about the application, and delete them if no account is opened within 12 months.

## 6. Where data is stored

Data is held on Google Cloud in the **London (`europe-west2`) region** ✅. Some sub-processors
in §7 operate outside the UK; where they do, transfers rely on the UK International Data Transfer
Agreement or the UK Addendum to the EU Standard Contractual Clauses, or on an adequacy decision.

## 7. Sub-processors

| Provider | Purpose | Data | Location |
|---|---|---|---|
| Google Cloud / Firebase | Hosting, database, authentication, cloud functions | All service data | UK (London) ✅ — auth metadata may be processed in the EU/US per Google's terms |
| Brevo (Sendinblue) | Transactional and campaign e-mail | Recipient e-mail, name, message content, delivery events ✅ | EU |
| Stripe | Online payments and deposits under the salon's account | Payment amount, status, reference; card data handled by Stripe only ✅ | EU/US |
| Anthropic | AI assistant answers (salon panel and landing chat) — receives only the data the asking user can already see, no database access ✅ | Question text and the figures shown to the user | US |
| Telegram | Optional operational alerts to the salon owner ✅ | Alert text (booking summaries) | Global |
| Google Analytics 4 | Landing-site statistics, **only after consent** ✅ | Anonymised usage | US |
| Meta (WhatsApp Business Cloud API) | Booking confirmations by WhatsApp — **planned, not live** | Phone number, message template content | EU/US |

We will update this table before a new provider handles personal data.

## 8. Security

Each salon's data is isolated at the database rules layer, so one salon cannot read another's
records ✅. Access within a salon is role-based (owner, admin, staff) ✅. Deletion of client and
booking records is restricted to the salon owner or salOWN administrators ✅. Data is encrypted in
transit and at rest by the platform. We keep an audit trail of staff and client record changes ✅.

## 9. Your rights

Under UK GDPR you can ask for access to your data, correction, erasure, restriction, portability,
and you can object to processing based on legitimate interest. You can withdraw consent to
marketing at any time via the unsubscribe link.

- **Salon clients:** contact the salon first — they are the controller. If you contact us we will
  forward the request and assist.
- **Salons, staff, visitors:** e-mail info@salown.com. We answer within one month.

You can complain to the Information Commissioner's Office (ico.org.uk). We would rather hear
from you first.

## 10. Children

The Service is for businesses. Salons may record appointments for children booked by a parent or
guardian; that data is processed under §4 on the salon's instructions.

## 11. Changes

We will post changes here and, for material changes, e-mail account owners 14 days in advance.

---

## Facts this draft relies on — re-check when any of these move

| Fact | Where it lives |
|---|---|
| Region `europe-west2` | `salown-app/functions` region config, `docs/ROADMAP.md` §2 |
| Unsubscribe endpoint honoured by every send | `functions/src/index.ts` `salownEmailOptOut` + opt-out checks before send |
| Manage-booking link, e-mail-gated | `firestore.rules` bookings anonymous update branch; `/manage/{tenant}/{booking}` |
| GA4 consent-gated | `hosting/analytics.js` |
| AI receives only caller-visible data | `functions/src/ai/askAI.ts` header comment |
| Stripe: no card data, Connect model | `docs/STRIPE_CONNECT_PLAN.md`; TEST mode today |
| Tenant isolation, delete = owner or super-admin | `firestore.rules` `[G2]`, `[E1b]` |
| WhatsApp not live | `docs/WHATSAPP_PLAN.md`, roadmap `B7` |
