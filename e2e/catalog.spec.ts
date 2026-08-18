import { expect, test } from "@playwright/test";

test("loads the public catalog without visual or navigation regressions", async ({
  page,
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/productos");

  await expect(page).toHaveURL("/productos");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Equipo seleccionado para jugar mejor.",
    }),
  ).toBeVisible();
  await expect(page.getByAltText("Peter Golf Pro Shop")).toHaveCount(2);
  const editorialImage = page.getByAltText(
    "Bolsa con palos de golf, ropa, calzado y pelotas en una composición editorial",
  );
  await expect(editorialImage).toBeVisible();
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

  const productCards = page.locator("[data-product-card]");
  if ((await productCards.count()) > 0) {
    const firstProductLink = productCards
      .first()
      .locator('a[href^="/productos/"]')
      .first();
    const href = await firstProductLink.getAttribute("href");

    expect(href).toMatch(/^\/productos\/[a-z0-9-]+$/);
    await firstProductLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  } else {
    await expect(
      page.getByText(
        /Estamos preparando nuevo equipo|No pudimos cargar el Pro Shop/,
      ),
    ).toBeVisible();
  }

  expect(browserErrors).toEqual([]);
});
