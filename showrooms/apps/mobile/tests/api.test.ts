import { __resetSessionForTests, api, refreshSession, signIn, signOut } from "@/services/api";
import { mockFetch, session } from "./helpers";

const store = () => (globalThis as unknown as { __secureStore: Map<string, string> }).__secureStore;

beforeEach(() => {
  __resetSessionForTests();
  store().clear();
});

describe("mobile session handling", () => {
  it("stores the refresh token in SecureStore and identifies as a mobile client", async () => {
    const calls = mockFetch(() => ({ status: 200, body: session("r1") }));
    await signIn("/auth/login", { email: "w@example.com", password: "x" });
    expect(store().get("showrooms.refreshToken")).toBe("r1");
    expect((calls[0]!.init!.headers as Record<string, string>)["X-Client-Type"]).toBe("mobile");
  });

  it("refreshes once for concurrent 401s and retries with the new token (rotation)", async () => {
    store().set("showrooms.refreshToken", "old");
    let refreshes = 0;
    const calls = mockFetch((url, body) => {
      if (url.endsWith("/auth/refresh")) {
        refreshes++;
        expect(body).toEqual({ refreshToken: "old" });
        return { status: 200, body: session("new") };
      }
      const auth = (calls.at(-1)!.init!.headers as Record<string, string>).Authorization;
      return auth === "Bearer access-new" ? { status: 200, body: { data: { ok: true } } } : { status: 401, body: { error: { code: "TOKEN_EXPIRED", message: "expired" } } };
    });
    const results = await Promise.all([api("/favorites/ids"), api("/notifications/unread-count"), api("/vehicles/mine")]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshes).toBe(1);
    expect(store().get("showrooms.refreshToken")).toBe("new");
  });

  it("signs out locally when the refresh token is rejected", async () => {
    store().set("showrooms.refreshToken", "revoked");
    mockFetch(() => ({ status: 401, body: { error: { code: "UNAUTHENTICATED", message: "Session ended" } } }));
    expect(await refreshSession()).toBeNull();
    expect(store().has("showrooms.refreshToken")).toBe(false);
  });

  it("keeps the session when the network is down", async () => {
    store().set("showrooms.refreshToken", "keep");
    global.fetch = jest.fn(async () => {
      throw new TypeError("Network request failed");
    }) as unknown as typeof fetch;
    expect(await refreshSession()).toBeNull();
    expect(store().get("showrooms.refreshToken")).toBe("keep");
  });

  it("logout revokes the refresh token on the server and clears it", async () => {
    store().set("showrooms.refreshToken", "bye");
    const calls = mockFetch(() => ({ status: 204 }));
    await signOut();
    expect(calls[0]!.url).toMatch(/\/auth\/logout$/);
    expect(JSON.parse(String(calls[0]!.init!.body))).toEqual({ refreshToken: "bye" });
    expect(store().has("showrooms.refreshToken")).toBe(false);
  });

  it("surfaces API validation errors with field details", async () => {
    mockFetch(() => ({ status: 422, body: { error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", details: [{ path: "price", message: "Price looks too low" }] } } }));
    await expect(api("/vehicles/x", { method: "PATCH", body: {} })).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
  });
});
