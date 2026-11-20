import { expect, test } from "@playwright/test";

test("complete demo service request flow", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created. NOVA is ready.")).toBeVisible();

  await page.goto("/chat");
  await page.getByLabel("Write what you need").fill("I need AC repair in Ariana tomorrow");
  await page.locator('input[type="file"]').setInputFiles({
    name: "request-notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("The AC unit is in the living room."),
  });
  await expect(page.getByText("request-notes.txt")).toBeVisible();
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Uploaded: request-notes.txt")).toBeVisible();
  await expect(page.getByText("Service: air conditioning")).toBeVisible();
  await expect(page.getByText("Area: Ariana")).toBeVisible();
  await expect(page.getByText("No booking or provider contact will happen yet.")).toBeVisible();

  await page.getByRole("button", { name: "Create task, then search options" }).click();
  await expect(page.getByText(/Task created:/)).toBeVisible();
  await page.getByRole("link", { name: "Open task and search options" }).click();

  await expect(page.getByText("Demo service discovery available. NOVA will not contact or book a provider.")).toBeVisible();
  await page.getByRole("button", { name: "Search options" }).click();
  await expect(page.getByRole("heading", { name: "Demo AC Care" })).toBeVisible();
  await expect(page.getByText("Availability: Not provided")).toBeVisible();
  await expect(page.getByText("Price: Not provided")).toBeVisible();

  await page.getByRole("button", { name: "Select" }).click();
  await expect(page.getByRole("button", { name: "Confirm request" })).toBeVisible();
  await expect(page.getByText("Nothing has been booked. No external provider was contacted.")).toBeVisible();

  await page.getByRole("button", { name: "Confirm request" }).click();
  await expect(page.getByText("Request confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText("Your NOVA task is updated. Next step: real provider booking is not connected yet.")).toBeVisible();

  await page.getByRole("button", { name: "Complete" }).click();
  await expect(page.getByText("No next step. This task is done.")).toBeVisible();
});
