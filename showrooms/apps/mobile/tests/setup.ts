/* eslint-disable @typescript-eslint/no-require-imports */
// In-memory SecureStore so token handling can be tested without a device keystore.
const mockSecure = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(async (k: string) => mockSecure.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockSecure.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockSecure.delete(k)),
}));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn(), getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), getExpoPushTokenAsync: jest.fn(), setNotificationChannelAsync: jest.fn(), AndroidImportance: { HIGH: 4 } }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() }, useLocalSearchParams: () => ({}) }));
(globalThis as { __secureStore?: Map<string, string> }).__secureStore = mockSecure;
