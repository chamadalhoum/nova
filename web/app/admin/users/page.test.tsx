import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "../../providers";
import AdminUsersPage from "./page";
import { clearTokens, saveTokens } from "@/lib/api";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users" }));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const page = (items: Array<Record<string, unknown>>, total = items.length) => ({ items, total, limit: 50, offset: 0 });
const user = (id: string, email: string, full_name: string) => ({ id, email, full_name, role: "user", is_active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", locale: "en", timezone: "UTC", last_login_at: null });

afterEach(() => { cleanup(); clearTokens(); vi.restoreAllMocks(); });

it("searches users on the server after a debounce and preserves the query for pagination", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  const fetchMock = vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(page([user("1", "first@example.com", "First User")], 2))))
    .mockResolvedValueOnce(new Response(JSON.stringify(page([user("2", "second@example.com", "Second User")], 51))))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...page([user("3", "third@example.com", "Third User")], 51), offset: 50 })));
  render(<Providers><AdminUsersPage /></Providers>);

  await screen.findByText("First User");
  fireEvent.change(screen.getByPlaceholderText("Search users"), { target: { value: "  second  " } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 1000 });
  expect(fetchMock.mock.calls[1][0]).toContain("q=second");

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls[2][0]).toContain("q=second");
  expect(fetchMock.mock.calls[2][0]).toContain("offset=50");
});

it("links each user to its detail page and handles an empty server result", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(page([]))));
  render(<Providers><AdminUsersPage /></Providers>);

  expect(await screen.findByText("No users found")).toBeTruthy();
  expect(screen.getByText("No records")).toBeTruthy();
});
