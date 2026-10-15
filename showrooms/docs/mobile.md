# Mobile app

Expo SDK 57 · React Native 0.86 · Expo Router · NativeWind 4 · one codebase for Android (primary) and iOS.

## Run locally

```bash
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL: 10.0.2.2 (emulator) or your LAN IP (phone)
pnpm --filter @showrooms/mobile dev            # then "a" for Android, or scan with Expo Go / a dev build
```

Add the dev server origin (e.g. `http://localhost:8081`) to the API's
`CORS_ORIGINS` only if you use the web preview; native apps send no Origin.

## Structure

```
app/(auth)     welcome, role-selection, register, login, forgot/reset password, broker-onboarding, profile-setup
app/(buyer)    tabs: home, explore, saved, messages, profile
app/(seller)   tabs: dashboard, vehicles, add (opens the wizard), leads, profile
app/vehicle/[slug]   details · app/listing/[id]   6-step wizard · app/showroom/[kind]/[slug]
app/filters · notifications · analytics · subscription · verification
components/  features/  services/ (api, uploads, share, push, token storage)  stores/ (auth, filters)
```

## Builds (EAS)

```bash
npx eas init                                  # sets EAS_PROJECT_ID (needed for push tokens)
npx eas build -p android --profile preview    # APK for testers
npx eas build -p android --profile production # AAB for Play Store
npx eas build -p ios --profile production
```

`app.config.ts` declares Android package `ke.co.showrooms.app`, camera/media
permissions with plain-language reasons, verified app links for
`https://showrooms.co.ke/vehicles/*`, and `LSApplicationQueriesSchemes` for
WhatsApp on iOS.

## Notes

- Only `EXPO_PUBLIC_*` values are bundled, and they are public. No secrets.
- Images: picker → resize to 1600 px + JPEG 0.75 on device → direct upload with
  progress and retry. Lists request 480 px renditions and cache to disk.
- WhatsApp: `whatsapp://send?text=…` with a `wa.me` fallback, or the system
  share sheet. Posters are downloaded to the cache and shared as images. The
  app never sends messages by itself.
- Push: `expo-notifications` registers after sign-in on physical devices when
  `EAS_PROJECT_ID` is set; tokens are removed on sign-out.
