import { expect, test } from "@playwright/test";

test("loads the home page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
