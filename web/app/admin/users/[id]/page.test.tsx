import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "../../../providers";
import AdminUserDetailPage from "./page";
import { clearTokens, saveTokens } from "@/lib/api";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users/user-1", useParams: () => ({ id: "user-1" }) }));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => { cleanup(); clearTokens(); vi.restoreAllMocks(); });

it("renders User 360 account information, tasks and service requests", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: "user-1", email: "detail@example.com", full_name: "Detail User", locale: "fr", timezone: "UTC", role: "user", is_active: true, created_at: "2026-01-01", updated_at: "2026-01-02", last_login_at: "2026-01-03" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "task-1", user_id: "user-1", conversation_id: null, title: "Repair AC", category: "repair", intent: "service", status: "CONFIRMED", priority: "normal", due_date: null, created_at: "2026-01-01", updated_at: "2026-01-02" }], total: 1, limit: 50, offset: 0 })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: "request-1", user_id: "user-1", task_id: "task-1", provider_id: null, status: "PREPARED", risk_level: "LOW", external_action_executed: false, category: "repair", location: null, created_at: "2026-01-01", updated_at: "2026-01-02" }], total: 1, limit: 50, offset: 0 })));

  render(<Providers><AdminUserDetailPage /></Providers>);

  expect(await screen.findByText("Detail User")).toBeTruthy();
  expect(screen.getAllByText("detail@example.com")).toHaveLength(2);
  expect(screen.getByText("2026-01-03")).toBeTruthy();
  expect(await screen.findByText("Repair AC")).toBeTruthy();
  expect(await screen.findByText("repair")).toBeTruthy();
});

it("does not render User 360 content without an admin session", () => {
  render(<Providers><AdminUserDetailPage /></Providers>);

  expect(screen.getByText("Admin login required")).toBeTruthy();
  expect(screen.queryByText("User 360")).toBeNull();
});

it("shows a safe error when the requested user does not exist", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/admin/users/user-1")) {
      return Promise.resolve(new Response(JSON.stringify({ detail: "User not found" }), { status: 404 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ items: [], total: 0, limit: 50, offset: 0 })));
  });
  render(<Providers><AdminUserDetailPage /></Providers>);

  expect(await screen.findByText("User not found")).toBeTruthy();
  expect(screen.queryByText("Detail User")).toBeNull();
});
