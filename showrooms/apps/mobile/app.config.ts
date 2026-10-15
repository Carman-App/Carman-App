import type { ExpoConfig } from "expo/config";

/**
 * Only EXPO_PUBLIC_* values reach the app bundle, and they are public.
 * Never put secrets here: the app talks to the Showrooms API, which holds
 * every credential (Cloudinary, Daraja, Resend).
 */
const config: ExpoConfig = {
  name: "Showrooms",
  slug: "showrooms",
  scheme: "showrooms",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/images/icon.png",
  android: {
    package: "ke.co.showrooms.app",
    adaptiveIcon: { foregroundImage: "./assets/images/icon.png", backgroundColor: "#1C1F23" },
    softwareKeyboardLayoutMode: "resize",
    permissions: ["android.permission.CAMERA", "android.permission.READ_MEDIA_IMAGES", "android.permission.READ_MEDIA_VIDEO"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "showrooms.co.ke", pathPrefix: "/vehicles" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  ios: {
    bundleIdentifier: "ke.co.showrooms.app",
    supportsTablet: false,
    infoPlist: {
      NSPhotoLibraryUsageDescription: "Choose photos of the vehicles you are selling.",
      NSCameraUsageDescription: "Take photos of the vehicles you are selling.",
      LSApplicationQueriesSchemes: ["whatsapp"],
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    ["expo-image-picker", { photosPermission: "Choose photos of the vehicles you are selling.", cameraPermission: "Take photos of the vehicles you are selling." }],
    ["expo-media-library", { savePhotosPermission: "Save WhatsApp Status posters to your gallery." }],
    ["expo-notifications", { color: "#C2410C" }],
    ["expo-splash-screen", { backgroundColor: "#FFFFFF", image: "./assets/images/icon.png", imageWidth: 96 }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
