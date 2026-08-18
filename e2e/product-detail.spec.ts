import { expect, test } from "@playwright/test";

test("loads a real product detail with its commercial data and navigation", async ({
  page,
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/productos");

  const firstProductLink = page
    .locator("[data-product-card]")
    .first()
    .locator('a[href^="/productos/"]')
    .first();
  const href = await firstProductLink.getAttribute("href");

  expect(href).toMatch(/^\/productos\/[a-z0-9-]+$/);
  await firstProductLink.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));

  const productDetail = page.locator("[data-product-detail]");
  await expect(productDetail.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(productDetail.getByText("MXN").first()).toBeVisible();
  await expect(
    productDetail.getByRole("button", { name: "Agregar a Mi Bolsa" }),
  ).toBeVisible();

  const editorialImage = page.getByAltText(
    "Golfista recibiendo asesoría mientras revisa equipo de golf",
  );
  await expect(editorialImage).toBeVisible();
  await editorialImage.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      editorialImage.evaluate(
        (element) =>
          (element as HTMLImageElement).complete &&
          (element as HTMLImageElement).naturalWidth > 0,
      ),
    )
    .toBe(true);

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  const backToShop = page
    .getByRole("navigation", { name: "Ruta del producto" })
    .getByRole("link", { name: "Pro Shop" });
  await expect(backToShop).toHaveAttribute("href", "/productos");
  await backToShop.click();
  await expect(page).toHaveURL("/productos");

  expect(browserErrors).toEqual([]);
});
