/**
 * Incoming links from the system (Expo Router's native intent hook).
 *
 * Expo Go and Android reopen the app on the address of the last screen
 * (e.g. /record/add), sometimes as a link that arrives just after start-up,
 * after the launch redirect has run. Every launch must open on Welcome or
 * the unfinished set-up step (app/index.tsx decides), so any link at
 * start-up goes to "/" instead. Links later in the session are kept.
 */
const startedAt = Date.now();
const STARTUP_MS = 10_000;

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (initial || Date.now() - startedAt < STARTUP_MS) return '/';
  return path;
}
