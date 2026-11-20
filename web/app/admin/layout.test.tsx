import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "../providers";
import AdminLayout from "./layout";
import { clearTokens, saveTokens } from "@/lib/api";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/admin" }));
afterEach(() => { cleanup(); clearTokens(); vi.restoreAllMocks(); });

for (const role of ["admin", "user"]) {
  it(`gates admin content for ${role}`, async () => {
    saveTokens({ access_token: "A", refresh_token: "R" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ email: "a@example.com", role })));
    render(<Providers><AdminLayout><p>Private administration</p></AdminLayout></Providers>);
    if (role === "admin") expect(await screen.findByText("Private administration")).toBeTruthy();
    else {
      expect(await screen.findByText("Access denied")).toBeTruthy();
      expect(screen.queryByText("Private administration")).toBeNull();
    }
  });
}

it("does not render private content when signed out", () => {
  clearTokens();
  render(<Providers><AdminLayout><p>Private administration</p></AdminLayout></Providers>);
  expect(screen.getByText("Admin login required")).toBeTruthy();
  expect(screen.queryByText("Private administration")).toBeNull();
});

it("shows loading then network error without mounting admin content", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  let fail!: (error: Error) => void;
  vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((_resolve, reject) => { fail = reject; }));
  render(<Providers><AdminLayout><p>Private administration</p></AdminLayout></Providers>);
  expect(screen.getByText("Checking admin access...")).toBeTruthy();
  fail(new TypeError("Network unavailable"));
  expect(await screen.findByText("Network unavailable")).toBeTruthy();
  expect(screen.queryByText("Private administration")).toBeNull();
});

it("clears private caches on account change without remounting page state", async () => {
  let client!: ReturnType<typeof useQueryClient>;
  function Probe() { client = useQueryClient(); return null; }
  saveTokens({ access_token: "A", refresh_token: "RA" });
  render(<Providers><Probe /></Providers>);
  const old = client;
  old.setQueryData(["tasks"], ["private-A"]);
  act(() => saveTokens({ access_token: "B", refresh_token: "RB" }));
  await waitFor(() => expect(client).toBe(old));
  expect(old.getQueryData(["tasks"])).toBeUndefined();
});
