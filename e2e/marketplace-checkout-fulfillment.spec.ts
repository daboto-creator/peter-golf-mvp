import { expect, test } from "@playwright/test";

test.describe("Marketplace checkout, fulfillment and Partner finance security shell", () => {
  for (const path of [
    "/partner/ventas",
    "/partner/pagos",
    "/operacion/marketplace/ordenes",
    "/operacion/marketplace/pagos",
  ]) {
    test(`${path} blocks anonymous access without a runtime error`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/iniciar-sesion");
      await expect(page.locator("body")).not.toContainText(
        /Internal Server Error|Application error/i,
      );
    });
  }

  test("Marketplace remains absent from the public catalog", async ({
    page,
  }) => {
    await page.goto("/productos");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/Vendido por un Best Round Partner verificado/i),
    ).toHaveCount(0);
  });
});
