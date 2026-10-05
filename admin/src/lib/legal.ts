/** Contact details shown on the public legal pages (src/app/legal). */
export const supportEmail = () => process.env.SUPPORT_EMAIL || "support@carma.app";
export const companyName = () => process.env.COMPANY_NAME || "Carma";

/**
 * The version of the Terms and Privacy Policy the app asks people to accept.
 * Bump it when either page changes in substance; consents record which
 * version each person agreed to (PRIV-01).
 */
export const TERMS_VERSION = "2026-10";
