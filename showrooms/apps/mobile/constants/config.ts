import Constants from "expo-constants";

/** Public configuration only. 10.0.2.2 reaches the host machine from the Android emulator. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:4000/api/v1";
export const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? "https://showrooms.co.ke";
export const EAS_PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;

export const listingUrl = (slug: string) => `${SITE_URL}/vehicles/${slug}`;
