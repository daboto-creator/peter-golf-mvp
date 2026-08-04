import { expect, test } from "@playwright/test";

test("loads the home page", async ({ page }) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Peter Golf Pro Shop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explorar productos" }),
  ).toHaveAttribute("href", "/productos");
  await expect(page.getByText("Create Next App")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});
