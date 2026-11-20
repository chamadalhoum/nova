import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "@/app/providers";
import { clearTokens } from "@/lib/api";
import { UserShell } from "./user-shell";

const replace = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace }),
}));

afterEach(() => {
  cleanup();
  clearTokens();
  replace.mockReset();
  pathname = "/";
  vi.restoreAllMocks();
});

it("keeps the public home visible without a token or private API request", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(<Providers><UserShell><p>Accueil public</p></UserShell></Providers>);

  expect(await screen.findByText("Accueil public")).toBeTruthy();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it("redirects an unauthenticated visitor from /app to login", async () => {
  pathname = "/app";
  render(<Providers><UserShell><p>Espace privé</p></UserShell></Providers>);

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
});
