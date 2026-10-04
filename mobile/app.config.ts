import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with the settings sign-in needs, read from env so ids
 * never live in the repo:
 * - EXPO_PUBLIC_IOS_BUNDLE_ID / EXPO_PUBLIC_ANDROID_PACKAGE: the store ids.
 *   Apple's identity token is issued to the bundle id, so it must match the
 *   server's APPLE_AUDIENCES.
 * - EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: the reversed iOS client id
 *   (com.googleusercontent.apps.…). Google sign-in is only built in when set.
 * - EAS_PROJECT_ID: the EAS project (push notifications); GOOGLE_SERVICES_JSON:
 *   the Firebase file for Android push.
 * Google and Apple sign-in need a development build (`npx expo run:ios`,
 * `npx expo run:android` or EAS), not Expo Go.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  // A store build without real ids, a real API or with the demo account
  // would be rejected or broken: fail the build early instead.
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    const missing = ['EXPO_PUBLIC_IOS_BUNDLE_ID', 'EXPO_PUBLIC_ANDROID_PACKAGE', 'EXPO_PUBLIC_API_URL'].filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`Production build needs ${missing.join(', ')} (set them in the EAS production environment).`);
    if (!process.env.EXPO_PUBLIC_API_URL!.startsWith('https://')) throw new Error('EXPO_PUBLIC_API_URL must be https:// in production (iOS blocks plain http).');
    if (process.env.EXPO_PUBLIC_DEV_ACCOUNT_ID) throw new Error('Remove EXPO_PUBLIC_DEV_ACCOUNT_ID from the production environment.');
  }

  const plugins: ExpoConfig['plugins'] = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    'expo-secure-store',
    ['expo-image-picker', { cameraPermission: 'Carma uses the camera to photograph your vehicle documents and receipts.', photosPermission: false }],
    // Scan VIN: reads the barcode on the VIN sticker. No microphone.
    ['expo-camera', { cameraPermission: 'Carma uses the camera to photograph your vehicle documents and receipts, and to read the barcode on the VIN sticker.', recordAudioAndroid: false }],
    // Push notifications (src/features/notifications/push.ts). Android
    // delivery also needs the Firebase file (GOOGLE_SERVICES_JSON below).
    ['expo-notifications', { color: '#134B9C' }],
    // Place sheet: "Use my current location". Only while the app is open.
    ['expo-location', { locationWhenInUsePermission: 'Carma uses your location to find the station, workshop or shop you are at.', isAndroidBackgroundLocationEnabled: false }],
  ];
  // Native crash reporting and readable stack traces: only built in when Sentry is configured.
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    plugins.push(['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]);
  }
  const googleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (googleScheme) plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }]);

  return {
    ...config,
    name: config.name ?? 'Carma',
    slug: config.slug ?? 'Carman-App',
    version: config.version ?? '1.0.0',
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || config.ios?.bundleIdentifier,
      usesAppleSignIn: true,
    },
    android: {
      ...config.android,
      package: process.env.EXPO_PUBLIC_ANDROID_PACKAGE || config.android?.package,
      // Firebase config for Android push (an EAS "file" environment variable).
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile,
    },
    // The EAS project: push tokens are issued per project (`eas init` prints the id).
    extra: {
      ...config.extra,
      eas: { ...(config.extra?.eas as object | undefined), ...(process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : {}) },
    },
    plugins,
  };
};
