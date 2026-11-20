import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("renders the public NOVA home without private API requests", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  render(<HomePage />);

  expect(screen.getByRole("heading", { name: /transformez vos besoins en actions concrètes/i })).toBeTruthy();
  expect(screen.getAllByRole("link", { name: /se connecter/i })[0].getAttribute("href")).toBe("/login");
  expect(screen.getAllByRole("link", { name: /commencer gratuitement/i })[0].getAttribute("href")).toBe("/register");
  expect(fetchSpy).not.toHaveBeenCalled();
});
