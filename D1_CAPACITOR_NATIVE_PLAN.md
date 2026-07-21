# D1 — Moving the Staff App to Native (Capacitor + App Store) — Detailed Plan

> **Status: 🅿️ READY, WAITING / NO rush.** Owner decision (2026-07-14): *"we need to put more mileage on our app, I'm not in a hurry."* Native wrapping is a **packaging/distribution** step — it's applied whenever wanted after the product (the staff app's own flows) has matured. The plan is ready so that when that day comes we don't have to think it through from scratch.
>
> ROADMAP summary: see `ROADMAP.md` → D1. Related: D2 (Apple sign-in — shares the same Apple Developer account), D4 (emoji→SVG icon system = Capacitor-safe prep ALREADY done), D5 (iOS viewport/drift root-cause fix ALREADY done).

## 1. Why (rationale)
- **Web push is fragile on iOS:** PWA notification works only if installed via "add to home screen" and with iOS 16.4+; the user experience is unreliable. A native app gives **real APNs push** → barbers reliably receive notifications.
- **The "delete-reinstall / clear cache" hassle ends:** with a native app + OTA, version management moves to the developer's control; the user doesn't have to clear cache manually (see §5).
- Being in the App Store = institutional trust + easy distribution (instead of a link to the barber, "download from the App Store").

## 2. Current state (2026-07-14 repo finding)
- **Capacitor is NOT installed** — a from-scratch native wrap. No `@capacitor/*` in `package.json`; no `ios/` `android/` folders.
- The staff app is a **separate Vite build**: `vite.staff.config.js` → output `hosting/staff-bundle/` (entry `staff.html` → renamed to `index.html`). **This folder becomes Capacitor's `webDir` as-is — architecturally compatible.**
- **Push is currently via web FCM:** `src/staff/StaffApp.tsx` `firebase/messaging` `getToken` (VAPID key) + `hosting/staff-bundle/sw.js` (service worker, `onBackgroundMessage`). Token → `tenants/{tid}/fcmTokens/{token}` (`uid`/`barberName`/`role`/`updatedAt`).
- **The server side is ready and native-compatible:** `functions/src/notifications/index.ts` `_sendFcmPush` → `admin.messaging().sendEachForMulticast(tokens)` + dead-token cleanup (`registration-token-not-registered` → doc.delete). **This FCM multicast works as-is with native tokens too → the backend is barely touched.**
- Stack: Firebase v12, React 19, react-router 7, Vite 8 — all compatible with Capacitor.
- **Prep already done:** D4 icon system (all emoji → inline SVG, "Capacitor-safe") + D5 viewport fix (`maximum-scale=1`, `touch-action`). So the groundwork is being laid gradually.

## 3. Prerequisites (things to obtain before writing code)
| Requirement | Detail | Cost | Who |
|---|---|---|---|
| **Apple Developer Program** | Mandatory for App Store publishing + APNs. SHARED with D2 (Apple sign-in). | **$99/year** | Owner |
| **Mac + Xcode** | iOS build is done **only on macOS** (impossible on Linux). The team has a Mac (other sessions work from there). | — | Have ✅ |
| **APNs Auth Key (.p8)** | Apple Developer → Keys → new APNs key → Firebase Console → Cloud Messaging → uploaded to the iOS app. The bridge for FCM to reach the iPhone. | Free | Owner + developer |
| **Bundle ID** | e.g. `com.whitecross.staff` (or `com.salown.staff` — multi-tenant brand decision). Registered as an App ID at Apple. | — | Owner's call |
| **Google Play Console** (if Android is also wanted) | One-time registration. | $25 (one-time) | Owner |

## 4. Phases

### Phase 1 — Capacitor shell (½–1 day)
1. `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
2. `npx cap init` → app name + **Bundle ID**; `capacitor.config.ts` `webDir: 'hosting/staff-bundle'`.
3. `npx cap add ios` (+ `android` if wanted) → native projects are generated (`ios/`, `android/`).
4. Build flow: `npm run build:staff && npx cap sync` (copies the web build into the native shell). Bind this to an `npm run build:native` script.
5. Icon + splash: generated from a single source with `@capacitor/assets`.
6. `npx cap open ios` → Xcode → run in the simulator.
- **DoD:** the staff app opens in the iPhone simulator, login + basic flow works (native push not yet).

### Phase 2 — Native push (1–2 days — the heart of the work)
1. `npm i @capacitor/push-notifications` (or `@capacitor-firebase/messaging` — gives the Firebase token directly, preferred).
2. Branch `src/staff/StaffApp.tsx` `initFCM` **by platform** (`Capacitor.isNativePlatform()`):
   - **Web** → the existing `firebase/messaging` path stays AS-IS (the PWA keeps working).
   - **Native** → via the Capacitor plugin: request permission → register → get the **FCM token** → write to the same `tenants/{tid}/fcmTokens/{token}` path with the same schema (`uid`/`barberName`/`role`/`updatedAt`). **The Firestore schema + server send DON'T CHANGE.**
   - Foreground message: the native `pushNotificationReceived` listener instead of `onMessage` (the toast logic in StaffRouter is preserved).
3. **iOS APNs:** upload the `.p8` key to the Firebase Console. In Xcode enable **Signing & Capabilities → Push Notifications + Background Modes (Remote notifications)**.
4. On logout, token deletion (existing `handleLogout` logic) should also work for the native token.
- **DoD:** native push lands on a real iPhone (TestFlight); the iOS fragility of web-push is over. The native token appears in `fcmTokens`, dead web tokens are cleaned up as before.

### Phase 3 — OTA / over-the-air update (½ day)
- **Goal:** JS/HTML/CSS changes (e.g. like today's revenue fix) go out instantly without waiting for App Store approval. The user does nothing.
- **Tool:** **Capgo** (open source, affordable — recommended) or Ionic Appflow Live Updates. After build, the bundle is pushed to Capgo; the app downloads + applies the new version on launch.
- **Apple rule (critical):** OTA is for the web layer only. A native functionality/permission change still requires an App Store build (App Store Guideline 4.2/2.5.2 — only "bug fixes and content updates" may go through OTA).
- **DoD:** build a JS change and push to Capgo → an installed device gets the new version on launch (without going through the store).

### Phase 4 — Store publish (½ day of development + 1–3 days Apple review)
1. Privacy manifest (`PrivacyInfo.xcprivacy`), notification permission explanation text (Info.plist fields like `NSUserNotificationsUsageDescription`).
2. App Store Connect: app registration, screenshots, description, category.
3. TestFlight → owner + barbers test on real devices.
4. Submit to the App Store → Apple review → publish.
- **DoD:** live in the App Store; barbers download it from the store.

## 5. Why does the "delete-reinstall" hassle end? (owner question 2026-07-14)
| Change type | How it ships | Apple approval | What the user does |
|---|---|---|---|
| Bug/logic/screen (e.g. revenue fix) | **OTA — instant** (Phase 3) | ❌ Not needed | Nothing; it's current on open |
| New native feature / permission / SDK | New App Store build (Phase 4) | ✅ 1–3 days | Auto-updates (iOS default auto-update) |

The PWA "clear cache / delete-reinstall the shortcut" need doesn't exist in native — the app manages the version itself.

## 6. Effort & cost summary
| Phase | Duration | Note |
|---|---|---|
| 1 — Shell | ½–1 day | Developer (on Mac) |
| 2 — Native push | 1–2 days | Most critical; backend unchanged |
| 3 — OTA | ½ day | Ends the delete-reinstall hassle |
| 4 — Store | ½ day + Apple review | Signing/submission steps on Mac, owner+developer |
| **Total** | **~3–4 days of development** | + $99/year Apple (+$25 one-time Play, if wanted) |

## 7. Risks & open decisions (for the owner)
1. **Bundle ID / brand:** `com.whitecross.staff` or `com.salown.staff`? Since it's multi-tenant, one "salOWN Staff" app, or a white-label app per tenant? → **Recommendation:** a single `salOWN Staff` app (differentiated by tenant login); white-label is separate work later.
2. **Apple guideline 4.2 ("minimum functionality"):** pure web-wrapper apps are sometimes rejected. Passed by adding native push + offline + native feel; avoid the full-remote (loading the live site via `server.url`) approach → keep the bundle embedded + update via OTA.
3. **Android parallelism:** comes from the same Capacitor project; extra ~½ day + Play $25. Does the owner want Android too?
4. **D2 link:** the Apple Developer account is SHARED with D2 (Apple sign-in) — it's efficient to handle both in the same account setup.

## 8. First command to start (reference)
```bash
cd ~/alex/salOWN
npm i @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "salOWN Staff" com.salown.staff --web-dir hosting/staff-bundle
npx cap add ios
npm run build:staff && npx cap sync
npx cap open ios   # opens Xcode (Mac required)
```

---
*This document is in READY-WAIT status; when work starts, ROADMAP D1 is marked ✅+hash and an entry is added to [[edit-log-salown]]. Maintenance: if a native-related change happens in the staff app (e.g. a new permission requirement), note it here.*
