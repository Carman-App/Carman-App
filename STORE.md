# Submitting Carma to the App Store and Google Play

What the code already does for review, what you must set up in the store
consoles, and the answers to the privacy questionnaires. Read DEPLOY.md first:
the API must be live on **https** before you submit.

## Already in the app

| Requirement | Where |
|---|---|
| Real app name, icon, adaptive icon, splash (no Expo template art) | `mobile/app.json`, `mobile/assets/images/` |
| Sign in with Apple offered whenever Google sign-in is (Guideline 4.8) | Welcome sign-in sheet; on iPhone Google is hidden unless Apple is available |
| In-app account deletion (App Store 5.1.1(v), Play account deletion policy) | My profile → Delete my account; `DELETE /api/v1/account`; data purged after 30 days by the worker |
| Public account-deletion page for the Play listing | `https://<your-api>/legal/delete-account` |
| Privacy policy and terms, reachable in the app and on the web | My profile → Privacy; `/legal/privacy`, `/legal/terms` |
| Subscriptions only through App Store / Google Play billing, with Restore purchases, Manage subscription and the auto-renew terms on the purchase screen (3.1.1, 3.1.2) | My profile → Subscription and billing |
| Push notifications only after the system permission prompt; each kind can be turned off | My profile → Notifications |
| Only the permissions used: camera (document photos), internet | Microphone, storage and overlay permissions are removed (`android.blockedPermissions`); dictation uses the keyboard's microphone |
| Camera permission text | `mobile/app.config.ts` (expo-image-picker plugin) |
| Export compliance: standard HTTPS only | `ITSAppUsesNonExemptEncryption: false` |
| Privacy manifest (required-reason APIs) | `ios.privacyManifests` in `app.json` |
| iPhone only, portrait | `supportsTablet: false` (no iPad screenshots needed) |
| No demo account or development shortcuts in store builds | Demo account only under `__DEV__`; the server ignores it in production; production builds fail if `EXPO_PUBLIC_DEV_ACCOUNT_ID` is set |
| Unfinished screens unreachable | Placeholder routes (cards, bench, inspection…) have no links |

## Before you submit — you must do these

1. **Pick the store ids** and set them in the EAS *production* environment:
   `EXPO_PUBLIC_IOS_BUNDLE_ID` (e.g. `com.yourcompany.carma`),
   `EXPO_PUBLIC_ANDROID_PACKAGE`, `EXPO_PUBLIC_API_URL` (https). A production
   build stops with a clear error if any is missing.
2. **Sign-in:** create the Apple and Google credentials (DEPLOY.md → Sign-in
   setup) and put the same ids on the server (`APPLE_AUDIENCES`,
   `GOOGLE_CLIENT_IDS`). Reviewers sign in with Sign in with Apple.
3. **Legal pages:** set `SUPPORT_EMAIL` and `COMPANY_NAME` on the server, and
   have the privacy policy and terms (`admin/src/app/legal/`) reviewed for your
   company and countries. They describe what the code does today.
4. **Subscriptions:** create the products, RevenueCat and the webhook
   (DEPLOY.md → Subscriptions setup). In App Store Connect each subscription
   needs a display name, description, price, and a review screenshot of the
   Plan & billing screen; submit them with the app version. Without the
   RevenueCat keys the app shows plans without buy buttons and sells nothing.
5. **Push notifications:** EAS project id, iOS push key and Firebase for
   Android (DEPLOY.md → Push notifications setup).
6. **Build and upload:** `eas build --profile production --platform all`, then
   `eas submit` (or upload in the consoles).

## App Store Connect

- **Category:** Utilities (or Lifestyle). **Age rating:** 4+.
- **Privacy policy URL:** `https://<your-api>/legal/privacy`
- **Support URL:** a page or `mailto:` with `SUPPORT_EMAIL`.
- **Sign-in for review:** "Sign in with Apple". No demo credentials needed;
  say so in the review notes.
- **Review notes (suggested):** *Carma records a vehicle's costs, service and
  documents. Sign in with Apple, tap Get started and add a vehicle. The
  assistant on Home answers from the account's own records. Account deletion:
  My profile → Delete my account. Subscriptions: My profile → Subscription
  and billing (sandbox purchases work for review).*
- **App Privacy ("nutrition label")** — data linked to the user, not used for
  tracking:
  - Contact info: name, email address — App functionality.
  - User content: photos (documents), other user content (vehicle and cost
    records, questions to the assistant) — App functionality.
  - Identifiers: user ID — App functionality.
  - Diagnostics: crash data — App functionality (only if Sentry is enabled).
  - Purchases: purchase history — App functionality (which plan the account bought).
  - Location, contacts, browsing, health: not collected.
- **Screenshots:** 6.9" and 6.5" iPhone. Welcome, Home with an answer, a
  vehicle timeline, a record form, documents, the mechanic job board.

## Google Play Console

- **Account deletion URL:** `https://<your-api>/legal/delete-account`
- **Privacy policy:** `https://<your-api>/legal/privacy`
- **App access:** "All functionality is available after Sign in with Google";
  if reviewers need it, provide a test Google account.
- **Data safety** — data is encrypted in transit; users can request deletion;
  not shared with third parties for their own use (service providers are not
  "sharing" under Play's definition); not sold:
  - Personal info: name, email — collected, app functionality, account management.
  - Photos and files: photos, files and docs — collected, app functionality.
  - App activity: other user-generated content — collected, app functionality.
  - App info and performance: crash logs, diagnostics — collected, analytics /
    app functionality (only if Sentry is enabled).
  - Financial info: purchase history — collected, app functionality.
  - Device or other IDs: push notification token — collected, app functionality.
  - Location: not collected.
- **Content rating:** complete the questionnaire (no user-to-user public
  content, no gambling): Everyone.
- **Target audience:** 18+ (vehicle owners and mechanics).
- **Testing track:** new personal developer accounts must run a closed test
  (12+ testers for 14 days) before production access. Plan for it.

## Version numbers

`version` in `mobile/app.json` is the user-facing version (1.0.0). Build
numbers are managed by EAS (`appVersionSource: remote`, `autoIncrement` on the
production profile) — no manual bumps.
