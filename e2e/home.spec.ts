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
    page.getByRole("heading", {
      level: 1,
      name: "El equipo correcto cambia tu juego.",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: /Explorar el Pro Shop/ })
      .first(),
  ).toHaveAttribute("href", "/productos");
  await expect(page.getByAltText("Best Round Pro Shop")).toHaveCount(2);
  const brandLogos = page.getByAltText("Best Round Pro Shop");
  await expect(brandLogos.first()).toHaveAttribute(
    "src",
    /best-round-pro-shop-light\.png/,
  );
  await expect(brandLogos.last()).toHaveAttribute(
    "src",
    /best-round-pro-shop-dark\.png/,
  );
  await expect(page).toHaveTitle(
    "Best Round Pro Shop | Equipo elegido con criterio",
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "Best Round Pro Shop",
  );
  await expect
    .poll(() =>
      page
        .locator('script[type="application/ld+json"]')
        .evaluate((element) => element.textContent),
    )
    .toContain('"name":"Best Round Pro Shop"');
  await expect(page.locator("body")).not.toContainText("Peter Golf");
  await expect(
    page.getByRole("heading", { level: 2, name: "¿Qué quieres mejorar?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Equipo seleccionado." }),
  ).toBeVisible();
  const homeImages = page.getByRole("main").locator("img");
  expect(await homeImages.count()).toBeGreaterThanOrEqual(4);
  for (const image of await homeImages.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () =>
          image.evaluate(
            (element) =>
              (element as HTMLImageElement).complete &&
              (element as HTMLImageElement).naturalWidth > 0,
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  }
  await expect(page.getByText("Create Next App")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveText("");
  await expect(
    page.locator(
      "[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay",
    ),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
});
