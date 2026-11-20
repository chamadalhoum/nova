import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../../mobile/node_modules/expo-secure-store/build/SecureStore.js", () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => { values.set(key, value); },
    deleteItemAsync: async (key: string) => { values.delete(key); },
  };
});
import * as api from "../../mobile/lib/api";
import * as store from "../../mobile/node_modules/expo-secure-store";

const tokens = (name: string) => ({ access_token: name, refresh_token: `${name}-refresh` });
const response = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
beforeEach(async () => { vi.restoreAllMocks(); await api.clearTokens(); });

for (const replacement of [null, "B"]) {
  it(`mobile ignores late refresh after ${replacement ?? "logout"}`, async () => {
    await api.saveTokens(tokens("A"));
    let finish!: (value: Response) => void;
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(401)).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const request = api.apiFetch("/api/v1/me");
    const rejected = expect(request).rejects.toThrow("Session changed");
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    if (replacement) await api.saveTokens(tokens(replacement)); else await api.clearTokens();
    finish(response(200, tokens("late-A")));
    await rejected;
    expect(await store.getItemAsync("nova_access_token")).toBe(replacement);
  });
}

it("mobile refresh is shared by concurrent requests", async () => {
  await api.saveTokens(tokens("A"));
  let refreshes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url).endsWith("/auth/refresh")) { refreshes++; return response(200, tokens("renewed")); }
    return new Headers(init?.headers).get("Authorization") === "Bearer renewed" ? response(200, { ok: true }) : response(401);
  });
  await Promise.all([api.apiFetch("/api/v1/me"), api.apiFetch("/api/v1/tasks")]);
  expect(refreshes).toBe(1);
});

it("mobile retains session on network failure", async () => {
  await api.saveTokens(tokens("A"));
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(401)).mockRejectedValueOnce(new TypeError("Network unavailable"));
  await expect(api.apiFetch("/api/v1/me")).rejects.toThrow("Network unavailable");
  expect(await store.getItemAsync("nova_access_token")).toBe("A");
});
