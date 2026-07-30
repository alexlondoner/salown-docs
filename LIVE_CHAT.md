# LIVE_CHAT.md — salown.com live chat (LC1)

> **What this is:** the bot-first live chat on the salOWN landing page. A visitor gets an
> instant answer from Claude Haiku; the founder takes over from the super-admin panel when
> they're around. Status lives in [ROADMAP.md](ROADMAP.md) (`LC1`) — not here.
> **Why it is built and not bought:** [DECISIONS.md › ADR-017](DECISIONS.md#adr-017--landing-live-chat-built-not-bought-bot-first).

---

## The pieces

| Piece | Path | Role |
|---|---|---|
| Widget | `salown-app/hosting/chat-widget.js` | Vanilla JS bubble + panel. No framework, no Firebase SDK. One `<script defer>` in `hosting/index.html`. |
| Endpoint | `salown-app/functions/src/ai/landingChat.ts` | `salownLandingChat` — public HTTP fn, europe-west2. Four actions: `send` / `poll` / `handoff` / `lead`. |
| Sales knowledge | `salown-app/functions/src/ai/landingGuide.ts` | `LANDING_GUIDE` — what salOWN is, pricing, how to get in. Paired with the existing `productGuide.ts`. |
| Agent inbox | `super-admin/src/pages/LiveChat.jsx` | Conversation list + transcript + reply box. Route `/live-chat`. |
| Data | `superAdmin/liveChat/**` | Config doc, `sessions/{sessionId}`, `sessions/{id}/messages/{id}`, `ips/{ipHash}`. |

**No firestore.rules change.** Everything lives under `superAdmin/`, which the existing
`match /superAdmin/{document=**} { allow read, write: if isSuperAdmin(); }` rule already covers.
The visitor's browser never touches Firestore — it only ever talks to the endpoint. That is the
whole reason for this layout; see "Why the visitor polls" below.

---

## Flow

```
visitor types ──▶ POST {action:'send'}  ──▶ 4 cost guards ──▶ store visitor msg
                                                          └─▶ Haiku 4.5 ──▶ store bot msg ──▶ reply in the SAME response
                                                                  │
                                                                  └─ emits [[HANDOFF]] ─▶ needsHuman=true ─▶ Brevo email to info@salown.com
founder opens /live-chat ──▶ types a reply ──▶ session.mode='human' ──▶ THE BOT GOES SILENT
visitor's widget polls (6s) ──▶ agent message appears ──▶ "Ali · replying now"
founder clicks "Hand back to assistant" ──▶ mode='bot' ──▶ bot answers the next message
```

### Why the visitor polls instead of using a realtime listener
A Firestore listener would need the Firebase SDK on a static landing page **and** a public read
rule on the chat collection. Polling costs one request every 6 seconds and needs neither.
It is also nearly free in practice: **a bot-only conversation never polls at all** — the bot's
answer comes back inside the `send` response. Polling only starts once a human is involved
(`needsHuman` or `mode: 'human'`), at 6s while the panel is open and 45s while it's closed
(so an answer left while the visitor was away shows up as an unread badge).

---

## Cost & abuse control

This endpoint is unauthenticated by nature — visitors are strangers — so it can never get the
auth guard that closed the same hole on `askAI` (see SECURITY.md). Four independent ceilings
replace it:

| Guard | Limit | Where |
|---|---|---|
| Message length | 1000 chars | `MAX_MSG_CHARS` |
| Per session | 40 messages | `MAX_MSGS_PER_SESSION` |
| Per IP | 60 messages/hour | `MAX_MSGS_PER_IP_HOUR`, keyed on a **hash** of the IP |
| Global | 1500 messages/day | `superAdmin/liveChat.dailyCap`, default `DEFAULT_DAILY_CAP` |
| Kill switch | `superAdmin/liveChat.enabled = false` | stops all spend with no deploy |

Model: `claude-haiku-4-5`, `max_tokens: 500`, both guides sent as a **cached** system prompt.
The IP is only ever stored as a SHA-256 hash (GDPR: an IP is personal data), used purely to
count requests. It is never shown in the admin inbox.

**Origin list is not a security control.** `ALLOWED_ORIGINS` stops a browser on another site
embedding the widget; it does nothing against curl. The rate limits are the real protection.

---

## The bot's rules

The system prompt is built in `landingChat.ts`; the knowledge is `LANDING_GUIDE` + `PRODUCT_GUIDE`.
Hard rules given to the model: answer only from the guides, never invent a feature, price or date,
never offer a discount, never ask for card details, 2-4 sentences, reply in the visitor's language,
and steer interested visitors to the **Request a demo** form.

**Handoff token.** The model appends `[[HANDOFF]]` when the visitor asks for a person, wants custom
pricing/contract/press, reports an account problem, or the model can't answer. The server strips the
token, flags the session and emails the founder. The visitor never sees it.

### Maintenance rule (the one that matters)
`LANDING_GUIDE` duplicates the landing page's claims. **When the landing copy, pricing or the
invite-only flow changes, change `landingGuide.ts` in the same commit.** A bot quoting last
month's price is worse than no bot. Same discipline as the `productGuide.ts` rule in ROADMAP `C10`.

---

## Leads

If a visitor types an email anywhere in the chat, it is stored on the session and the founder is
emailed. It deliberately does **not** create a `superAdmin/waitlist/entries` record — a half-empty
application would pollute the Applications queue, which is a decision surface (approve → provisions
a tenant). Converting a chat lead into an application stays a human action.

---

## Running it locally

```bash
# 1. secrets for the emulator (gitignored via *.local)
cat > salown-app/functions/.secret.local <<'EOF'
ANTHROPIC_API_KEY=sk-ant-...      # without it the bot returns its fallback reply
BREVO_API_KEY=...                 # without it the founder notification is skipped
EOF

# 2. emulators (Java is required by the Firestore emulator)
cd salown-app
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npx firebase emulators:start \
  --only functions,firestore --project havuz-44f70

# 3. serve the landing page
python3 -m http.server 8081 --directory hosting
# → http://127.0.0.1:8081/index.html
```

The widget detects `localhost`/`127.0.0.1` and points itself at the functions emulator
(`http://127.0.0.1:5001/havuz-44f70/europe-west2/salownLandingChat`). Override with
`window.SALOWN_CHAT_ENDPOINT` before the script tag if you need something else.

To exercise the agent side locally, run the super-admin app (`cd super-admin && npm run dev`)
against the same emulator, or write to `superAdmin/liveChat/sessions/...` in the emulator UI.

---

## Deploy (when the owner approves it)

```bash
# functions — TARGETED, never blanket (a blanket deploy deletes the 27 us-central1 legacy fns)
firebase deploy --only functions:salown:salownLandingChat --project havuz-44f70
# hosting — the widget ships with the normal main→CI hosting deploy
# super-admin — its own deploy.sh
```
Secrets `ANTHROPIC_API_KEY` and `BREVO_API_KEY` already exist in the project; the new function
just declares them.

---

## Not built yet (Phase 3 candidates)

- Proactive greeting after N seconds on the pricing/demo section
- The widget on the other landing pages (`features`, `apps`, `vs-*`) — it is drop-in, one script tag
- 90-day transcript retention cron (GDPR)
- "Most-asked questions" report feeding the FAQ and SEO copy
- Email reply to a visitor who left an email and closed the tab
