import * as Sentry from '@sentry/react-native';

/**
 * Crash and error reporting (Sentry), on only when EXPO_PUBLIC_SENTRY_DSN is
 * set. No user data is attached: events carry the error, the device and the
 * app version, never record contents, and request bodies are not captured.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = !!dsn;

if (dsn) {
  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: 0.05,
    enableAutoSessionTracking: true,
    beforeBreadcrumb(b) {
      // Network breadcrumbs keep the URL path only (no query strings, which can hold ids).
      if (b.category === 'fetch' || b.category === 'xhr') {
        const url = typeof b.data?.url === 'string' ? b.data.url.split('?')[0] : undefined;
        return { ...b, data: { ...b.data, url } };
      }
      return b;
    },
  });
}

/** Wraps the root component when monitoring is on; a no-op otherwise. */
export function withMonitoring(Component: () => React.JSX.Element | null): React.ComponentType {
  return dsn ? Sentry.wrap(Component) : Component;
}
