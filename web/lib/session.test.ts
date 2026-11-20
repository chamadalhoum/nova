import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";

const response = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const tokens = (name: string) => ({ access_token: name, refresh_token: `${name}-refresh` });

beforeEach(() => { api.clearTokens(); vi.restoreAllMocks(); });

describe("session isolation", () => {
  it("refreshes normally and replays the request", async () => {
    api.saveTokens(tokens("A"));
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, tokens("renewed"))).mockResolvedValueOnce(response(200, { ok: true }));
    expect(await api.apiFetch("/api/v1/me")).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(api.getAccessToken()).toBe("renewed");
  });

  for (const replacement of [null, "B"]) {
    it(`ignores late refresh after ${replacement ?? "logout"}`, async () => {
      api.saveTokens(tokens("A"));
      let finish!: (value: Response) => void;
      const pending = new Promise<Response>((resolve) => { finish = resolve; });
      const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(401)).mockReturnValueOnce(pending);
      const request = api.apiFetch("/api/v1/me");
      const rejected = expect(request).rejects.toThrow("Session changed");
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
      if (replacement) api.saveTokens(tokens(replacement)); else api.clearTokens();
      finish(response(200, tokens("late-A")));
      await rejected;
      expect(api.getAccessToken()).toBe(replacement);
    });
  }

  it("ignores old private responses", async () => {
    api.saveTokens(tokens("A"));
    let finish!: (value: Response) => void;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const request = api.apiFetch("/api/v1/tasks");
    api.saveTokens(tokens("B"));
    finish(response(200, ["private A"]));
    await expect(request).rejects.toThrow("Session changed");
  });

  it("keeps tokens on temporary refresh failure", async () => {
    api.saveTokens(tokens("A"));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(503));
    await expect(api.apiFetch("/api/v1/me")).rejects.toThrow();
    expect(api.getAccessToken()).toBe("A");
  });
});
