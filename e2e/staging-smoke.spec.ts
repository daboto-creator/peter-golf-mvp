import { expect, test } from "@playwright/test";

const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();

test.describe("staging read-only smoke", () => {
  test.skip(!remoteBaseUrl, "Requires PLAYWRIGHT_BASE_URL for remote staging.");

  test("serves the home and public catalog without scaffold or visible errors", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Peter Golf Pro Shop" }),
    ).toBeVisible();
    await expect(page.getByText("Create Next App")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      /Application error|Internal Server Error|SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/i,
    );

    await page.goto("/productos");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Equipo seleccionado para jugar mejor.",
      }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /Application error|Internal Server Error|SUPABASE_SERVICE_ROLE_KEY|service_role|sb_secret_/i,
    );
  });

  test("reports Supabase health without configuration or data leakage", async ({
    request,
  }) => {
    const response = await request.get("/api/health/supabase");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = await response.text();
    expect(body).toContain('\"status\":\"available\"');
    expect(body).toContain('\"environment\":\"staging\"');
    expect(body).not.toMatch(
      /https?:\/\/|anon|service_role|NEXT_PUBLIC_SUPABASE|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|customer|email|phone/i,
    );
  });

  for (const protectedPath of ["/cuenta", "/operacion"]) {
    test(`${protectedPath} redirects an anonymous visitor`, async ({
      page,
    }) => {
      await page.goto(protectedPath);
      await expect(page).toHaveURL((url) => {
        return (
          url.pathname === "/iniciar-sesion" &&
          url.searchParams.get("next") === protectedPath
        );
      });
      await expect(
        page.getByRole("heading", { name: "Inicia sesión", exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel("Correo electrónico")).toBeVisible();
      await expect(page.getByLabel("Contraseña")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Iniciar sesión", exact: true }),
      ).toBeVisible();
    });
  }
});
