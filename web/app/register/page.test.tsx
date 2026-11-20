import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import RegisterPage from "./page";
import { clearTokens } from "@/lib/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => { cleanup(); clearTokens(); push.mockReset(); vi.restoreAllMocks(); });

it("requires password confirmation and opens the user workspace after registration", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh" })),
  );
  render(<RegisterPage />);

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "NOVA User" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secretpass123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secretpass123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  await waitFor(() => expect(push).toHaveBeenCalledWith("/app"));
});

it("shows a helpful error when password confirmation differs", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  render(<RegisterPage />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "NOVA User" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secretpass123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "otherpass123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
  expect(fetchSpy).not.toHaveBeenCalled();
});
