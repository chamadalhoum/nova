import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AppPage from "./page";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows the existing user workspace at /app", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ full_name: "NOVA User", email: "user@example.test" })))
    .mockResolvedValueOnce(new Response(JSON.stringify([])))
    .mockResolvedValueOnce(new Response(JSON.stringify([])))
    .mockResolvedValueOnce(new Response(JSON.stringify([])));

  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AppPage /></QueryClientProvider>);

  expect(await screen.findByText("Welcome, NOVA User")).toBeTruthy();
  expect(screen.getByText("No tasks yet")).toBeTruthy();
  expect(screen.getByText("No conversation yet")).toBeTruthy();
});
