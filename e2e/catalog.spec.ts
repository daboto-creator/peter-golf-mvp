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
  await expect(page.getByAltText("Best Round Pro Shop")).toHaveCount(2);
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

test("catalog filters remain usable without overflow across breakpoints", async ({
  page,
}) => {
  await page.goto("/productos");

  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByText("Filtrar equipo", { exact: true }).click();
  }

  await expect(page.locator('select[name="category"]:visible')).toBeVisible();
  await expect(page.locator('select[name="brand"]:visible')).toBeVisible();
  await expect(
    page.locator("button:visible", { hasText: "Aplicar filtros" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("catalog filters persist in the URL across reload and browser history", async ({
  page,
}) => {
  await page.goto("/productos");
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByText("Filtrar equipo", { exact: true }).click();
  }
  const category = page.locator('select[name="category"]:visible');
  const options = await category.locator("option").count();
  test.skip(options < 2, "The local catalog has no filterable category.");

  await category.selectOption({ index: 1 });
  const selected = await category.inputValue();
  await page.locator("button:visible", { hasText: "Aplicar filtros" }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/productos" &&
      url.searchParams.get("category") === selected,
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );

  await page.reload();
  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    await page.getByText("Filtrar equipo", { exact: true }).click();
  }
  await expect(page.locator('select[name="category"]:visible')).toHaveValue(
    selected,
  );

  await page.goto("/productos");
  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("category") === selected,
  );
});
