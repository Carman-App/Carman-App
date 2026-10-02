import { apiOk } from "@/lib/api/response";
import { providerAudiences } from "@/lib/auth/end-user";
import { devAccountHeaderAllowed } from "@/lib/api/auth";

// GET /api/v1/auth/config — which sign-in methods this server accepts, so the
// app only shows buttons that will work. Public: holds no secrets.
export async function GET() {
  const a = providerAudiences();
  return apiOk({ google: a.google.length > 0, apple: a.apple.length > 0, devAccount: devAccountHeaderAllowed() });
}
