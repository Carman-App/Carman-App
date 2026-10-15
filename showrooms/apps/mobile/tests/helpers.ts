export type FetchCall = { url: string; init?: RequestInit };

/** Minimal fetch double: responds by URL path and records calls. */
export function mockFetch(handler: (url: string, body: unknown) => { status: number; body?: unknown }) {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const parsed = init?.body ? JSON.parse(String(init.body)) : undefined;
    const { status, body } = handler(url, parsed);
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return calls;
}

export const session = (refreshToken: string, role = "BUYER") => ({
  data: { user: { id: "u1", name: "Wanjiku Kamau", email: "w@example.com", role, status: "ACTIVE", createdAt: "", updatedAt: "" }, accessToken: `access-${refreshToken}`, accessTokenExpiresAt: "", refreshToken },
});
