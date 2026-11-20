import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Providers } from "../../providers";
import AdminAIPage from "./page";
import { clearTokens, saveTokens } from "@/lib/api";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const event = { id: "ai-1", action: "ai.intent_processed", user_id: "user-1", data: { provider: "openai", model: "mini", intent: "repair", success: true, fallback_used: false, latency_ms: 120 }, created_at: "2026-01-01T00:00:00Z" };
const page = (items = [event], total = items.length, offset = 0) => ({ items, total, limit: 50, offset });

afterEach(() => { cleanup(); clearTokens(); vi.restoreAllMocks(); });

it("applies every AI filter with boolean query values", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify(page()))));
  render(<Providers><AdminAIPage /></Providers>);
  await screen.findByText("ai.intent_processed");
  fireEvent.change(screen.getByLabelText("AI provider"), { target: { value: "openai" } });
  fireEvent.change(screen.getByLabelText("AI model"), { target: { value: "mini" } });
  fireEvent.change(screen.getByLabelText("AI intent"), { target: { value: "repair" } });
  fireEvent.change(screen.getByLabelText("AI success"), { target: { value: "true" } });
  fireEvent.change(screen.getByLabelText("AI fallback"), { target: { value: "false" } });
  fireEvent.change(screen.getByLabelText("AI start date"), { target: { value: "2026-01-01T10:00" } });
  fireEvent.change(screen.getByLabelText("AI end date"), { target: { value: "2026-01-02T10:00" } });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const url = String(fetchMock.mock.calls[1][0]);
  for (const parameter of ["provider=openai", "model=mini", "intent=repair", "success=true", "fallback=false", "start_at=2026-01-01T10%3A00", "end_at=2026-01-02T10%3A00"]) expect(url).toContain(parameter);
});

it("preserves AI filters on pagination and resets to the first unfiltered page", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify(page([event], 51)))));
  render(<Providers><AdminAIPage /></Providers>);
  await screen.findByText("ai.intent_processed");
  fireEvent.change(screen.getByLabelText("AI provider"), { target: { value: "openai" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  await screen.findByRole("button", { name: "Next" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await screen.findByRole("button", { name: "Next" });
  expect(String(fetchMock.mock.calls[2][0])).toContain("provider=openai");
  expect(String(fetchMock.mock.calls[2][0])).toContain("offset=50");
  fireEvent.click(screen.getByRole("button", { name: "Reset" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
  expect(String(fetchMock.mock.calls[3][0])).toContain("offset=0");
  expect(String(fetchMock.mock.calls[3][0])).not.toContain("provider=");
});

it("shows loading, empty, and error states", async () => {
  saveTokens({ access_token: "A", refresh_token: "R" });
  let resolve!: (response: Response) => void;
  vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(<Providers><AdminAIPage /></Providers>);
  expect(screen.getByText("Loading AI events...")).toBeTruthy();
  resolve(new Response(JSON.stringify(page([]))));
  expect(await screen.findByText("No AI events yet")).toBeTruthy();
  view.unmount();

  vi.restoreAllMocks();
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network unavailable"));
  render(<Providers><AdminAIPage /></Providers>);
  expect(await screen.findByText("Network unavailable", {}, { timeout: 5_000 })).toBeTruthy();
});
