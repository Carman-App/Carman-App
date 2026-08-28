/**
 * End-user (Owner/Mechanic) authentication abstraction.
 *
 * NOT wired up yet — end-user auth (Apple/Google Sign-In per the mobile
 * app's onboarding screen) is a later phase that needs real OAuth
 * credentials the user hasn't provided. This interface exists so that
 * phase can drop in a real implementation without reshaping call sites.
 *
 * This is deliberately separate from the internal AdminUser login
 * (src/lib/auth/session.ts, src/lib/auth/password.ts), which is already
 * fully implemented and unaffected by this abstraction.
 */

export type AuthIdentity = {
  /** Stable id from the upstream provider (e.g. Apple/Google "sub"). */
  providerId: string;
  provider: "apple" | "google";
  email: string;
  name?: string;
};

export interface AuthProvider {
  /** Verify a provider-issued token/credential and return the identity it represents. */
  verifyCredential(credential: string): Promise<AuthIdentity>;
}

/**
 * No-op placeholder so the rest of the codebase can depend on
 * `AuthProvider` today. Swap for a real Apple/Google implementation when
 * credentials are available — nothing else should need to change.
 */
export class NoopAuthProvider implements AuthProvider {
  async verifyCredential(): Promise<AuthIdentity> {
    throw new Error(
      "End-user authentication is not configured yet. NoopAuthProvider is a placeholder pending Apple/Google OAuth credentials.",
    );
  }
}

export const authProvider: AuthProvider = new NoopAuthProvider();
