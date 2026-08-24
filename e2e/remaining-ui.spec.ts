import { expect, test } from "@playwright/test";

test("auth surfaces share the Best Round Pro Shop visual system", async ({
  page,
}) => {
  const browserErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const routes = [
    ["/iniciar-sesion", "Inicia sesión"],
    ["/registro", "Crea tu acceso a Mi Golf"],
    ["/recuperar-contrasena", "Recupera tu contraseña"],
  ] as const;

  for (const [route, heading] of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(route);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
    await expect(page.getByAltText("Best Round Pro Shop")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  expect(browserErrors).toEqual([]);
});

test("protected customer and operations routes preserve their auth redirect", async ({
  page,
}) => {
  const protectedRoutes = [
    "/carrito",
    "/checkout",
    "/cuenta",
    "/cuenta/pedidos",
    "/operacion",
  ];

  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL((url) => {
      return (
        url.pathname === "/iniciar-sesion" &&
        url.searchParams.get("next") === route
      );
    });
    await expect(
      page.getByRole("heading", { level: 1, name: "Inicia sesión" }),
    ).toBeVisible();
  }
});
