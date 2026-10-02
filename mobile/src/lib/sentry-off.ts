/**
 * Stand-in for @sentry/react-native when EXPO_PUBLIC_SENTRY_DSN is not set
 * (see metro.config.js). Monitoring is off then anyway; this keeps ~470
 * Sentry modules out of the bundle so development starts and reloads faster.
 * Only what src/lib/monitoring.ts uses is provided.
 */
export function init(): void {}
export function wrap<T>(component: T): T {
  return component;
}
export function captureException(): void {}
