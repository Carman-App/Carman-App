import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { api } from '@/data/api/client';
import { queryClient } from '@/data/queryClient';
import { qk } from '@/data/queryKeys';

/**
 * Push notifications. The server sends them through Expo's push service
 * (admin/src/lib/notifications/push.ts); this file asks permission, hands
 * the phone's push token to the server, and opens the right screen when a
 * notification is tapped.
 *
 * Needs a development or store build with an EAS project id (Expo Go cannot
 * receive remote push since SDK 53). Everything here is a no-op otherwise.
 */

type NotificationsModule = typeof import('expo-notifications');

const TOKEN_KEY = 'carma:push-token:v1';
let mod: NotificationsModule | null | undefined;

function load(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
  } catch {
    mod = null;
  }
  return mod;
}

function projectId(): string | undefined {
  return (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ?? Constants.easConfig?.projectId;
}

/** Where a tapped notification goes. */
function routeFor(data: Record<string, unknown> | undefined): string {
  if (typeof data?.route === 'string' && data.route.startsWith('/')) return data.route;
  if (typeof data?.vehicleId === 'string') return `/vehicle/${data.vehicleId}`;
  return '/notifications';
}

let handlersInstalled = false;

/** Shows notifications while the app is open and routes taps. Call once at startup. */
export function installNotificationHandlers(): () => void {
  const N = load();
  if (!N || handlersInstalled) return () => {};
  handlersInstalled = true;
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
  const received = N.addNotificationReceivedListener(() => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications() });
  });
  const tapped = N.addNotificationResponseReceivedListener((response) => {
    router.push(routeFor(response.notification.request.content.data as Record<string, unknown>));
  });
  // Opened from a notification while the app was closed: go there once the
  // launch redirect (Welcome / resume set-up / home) has run.
  void N.getLastNotificationResponseAsync().then((response) => {
    if (!response) return;
    const route = routeFor(response.notification.request.content.data as Record<string, unknown>);
    setTimeout(() => router.push(route), 800);
  });
  return () => {
    received.remove();
    tapped.remove();
    handlersInstalled = false;
  };
}

/**
 * Asks permission (once; the system remembers the answer) and registers this
 * phone with the server. Safe to call on every launch: it refreshes the token.
 */
export async function registerForPush(): Promise<void> {
  const N = load();
  const id = projectId();
  if (!N || !Device.isDevice || !id) return;
  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('default', { name: 'Carma', importance: N.AndroidImportance.HIGH });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== 'granted') status = (await N.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const { data: token } = await N.getExpoPushTokenAsync({ projectId: id });
    await api.post('push-tokens', { token, platform: Platform.OS });
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('[push] registration failed', e);
  }
}

/** On sign-out: this phone stops receiving the account's notifications. */
export async function unregisterPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await api.delete('push-tokens', { token }).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}
