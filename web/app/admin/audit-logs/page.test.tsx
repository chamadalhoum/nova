import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "../../providers";
import AdminAuditLogsPage from "./page";
import { clearTokens, saveTokens } from "@/lib/api";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const auditLog = { id: "log-1", action: "product.task_created", user_id: "user-1", data: { status: "CONFIRMED" }, created_at: "2026-01-01T00:00:00Z" };
const page = (items = [auditLog], total = items.length, offset = 0) => ({ items, total, limit: 50, offset });

afterEach(() => { cleanup(); clearTokens(); vi.restoreAllMocks(); });

it("applies every audit filter together and does not fetch while typing", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify(page()))));
  render(<Providers><AdminAuditLogsPage /></Providers>);
  await screen.findByText("product.task_created");

  fireEvent.change(screen.getByLabelText("Search audit logs"), { target: { value: " task " } });
  fireEvent.change(screen.getByLabelText("Audit action"), { target: { value: "product.task_created" } });
  fireEvent.change(screen.getByLabelText("Audit user ID"), { target: { value: "user-1" } });
  fireEvent.change(screen.getByLabelText("Audit start date"), { target: { value: "2026-01-01T10:00" } });
  fireEvent.change(screen.getByLabelText("Audit end date"), { target: { value: "2026-01-02T10:00" } });
  expect(fetchMock).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const url = String(fetchMock.mock.calls[1][0]);
  expect(url).toContain("q=task");
  expect(url).toContain("action=product.task_created");
  expect(url).toContain("user_id=user-1");
  expect(url).toContain("start_at=2026-01-01T10%3A00");
  expect(url).toContain("end_at=2026-01-02T10%3A00");
});

it("keeps applied audit filters while paginating and clears them on reset", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify(page([auditLog], 51)))));
  render(<Providers><AdminAuditLogsPage /></Providers>);
  await screen.findByText("product.task_created");
  fireEvent.change(screen.getByLabelText("Audit action"), { target: { value: "product.task_created" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await screen.findByRole("button", { name: "Next" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await screen.findByRole("button", { name: "Next" });
  expect(String(fetchMock.mock.calls[2][0])).toContain("action=product.task_created");
  expect(String(fetchMock.mock.calls[2][0])).toContain("offset=50");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(String(fetchMock.mock.calls[3][0])).toContain("offset=0");
  expect(String(fetchMock.mock.calls[3][0])).not.toContain("action=");
});

it("shows loading, empty, and error states", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  let resolve!: (response: Response) => void;
  vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(<Providers><AdminAuditLogsPage /></Providers>);
  expect(screen.getByText("Loading audit logs...")).toBeTruthy();
  resolve(new Response(JSON.stringify(page([]))));
  expect(await screen.findByText("No audit logs found")).toBeTruthy();
  view.unmount();

  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network unavailable"));
  render(<Providers><AdminAuditLogsPage /></Providers>);
  expect(await screen.findByText("Network unavailable", {}, { timeout: 5_000 })).toBeTruthy();
});
