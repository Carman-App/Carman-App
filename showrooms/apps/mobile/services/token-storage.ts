import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "showrooms.refreshToken";

/**
 * The refresh token lives in the platform keystore (Android Keystore / iOS
 * Keychain) via SecureStore. The short-lived access token stays in memory.
 * SecureStore has no web implementation; on web (previews only) the token is
 * kept in memory and never written to localStorage.
 */
let webMemory: string | null = null;

export const tokenStorage = {
  get: async () => (Platform.OS === "web" ? webMemory : SecureStore.getItemAsync(KEY)),
  set: async (token: string) => {
    if (Platform.OS === "web") webMemory = token;
    else await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  clear: async () => {
    if (Platform.OS === "web") webMemory = null;
    else await SecureStore.deleteItemAsync(KEY);
  },
};
