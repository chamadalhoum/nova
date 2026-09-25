import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { describe, expect, it } from "vitest";
import ChatPage from "./page";

describe("ChatPage", () => {
  it("renders the natural request input", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ChatPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText("What can I help you get done?")).toBeTruthy();
    expect(screen.getByLabelText("Write what you need")).toBeTruthy();
  });
});
