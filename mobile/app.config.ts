import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Extends app.json with the settings sign-in needs, read from env so ids
 * never live in the repo:
 * - EXPO_PUBLIC_IOS_BUNDLE_ID / EXPO_PUBLIC_ANDROID_PACKAGE: the store ids.
 *   Apple's identity token is issued to the bundle id, so it must match the
 *   server's APPLE_AUDIENCES.
 * - EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME: the reversed iOS client id
 *   (com.googleusercontent.apps.…). Google sign-in is only built in when set.
 * Google and Apple sign-in need a development build (`npx expo run:ios`,
 * `npx expo run:android` or EAS), not Expo Go.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: ExpoConfig['plugins'] = [
    ...(config.plugins ?? []),
    'expo-apple-authentication',
    'expo-secure-store',
    ['expo-image-picker', { cameraPermission: 'Carma uses the camera to photograph your vehicle documents and receipts.', photosPermission: false }],
  ];
  const googleScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (googleScheme) plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }]);

  return {
    ...config,
    name: config.name ?? 'Carma',
    slug: config.slug ?? 'Carman-App',
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.EXPO_PUBLIC_IOS_BUNDLE_ID || config.ios?.bundleIdentifier,
      usesAppleSignIn: true,
    },
    android: {
      ...config.android,
      package: process.env.EXPO_PUBLIC_ANDROID_PACKAGE || config.android?.package,
    },
    plugins,
  };
};
