import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LoginPage from "./page";
import { clearTokens } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => { cleanup(); clearTokens(); push.mockReset(); vi.restoreAllMocks(); });

it("redirects an authenticated administrator to the admin area", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ email: "admin@example.test", role: "admin" })));
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secretpass123" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
});

it("redirects an authenticated user to their workspace", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh" })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ email: "user@example.test", role: "user" })));
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secretpass123" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/app"));
});
