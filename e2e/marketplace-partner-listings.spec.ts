import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_LISTINGS_E2E === "1";
const password = "ListingsE2E123!";
const partnerEmail = "e2e.marketplace.listings@example.test";
const operatorEmail = "e2e.marketplace.listings-operator@example.test";
const pendingEmail = "e2e.marketplace.listings-pending@example.test";
const partnerBListingId = "43000000-0000-4000-8000-000000000010";
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.describe("Marketplace Partner listings @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_LISTINGS_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    prepareListingUsers();
  });

  test("VERIFIED Partner submits a version, corrects it, and receives human approval", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating review workflow runs once on Desktop.");
    await login(page, partnerEmail, "/partner/publicaciones");
    await page.getByRole("link", { name: "Publicar un producto" }).click();
    await page.getByLabel("Categoría").selectOption({ label: "Driver" });
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await expect(page).toHaveURL(
      /\/partner\/publicaciones\/[0-9a-f-]+\/producto$/,
    );
    const listingId = page.url().match(/publicaciones\/([0-9a-f-]+)\//)?.[1];
    expect(listingId).toBeTruthy();

    await page
      .getByLabel("Marca existente")
      .selectOption({ label: "Titleist" });
    await page.getByLabel("Proponer modelo").fill("GT3 E2E");
    await page
      .getByLabel("Título sugerido")
      .fill("Titleist GT3 Driver 9° Regular Right");
    await page
      .getByLabel("Descripción")
      .fill("Driver usado en excelente condición para revisión humana.");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();

    for (const [imageIndex, imageType] of ["face", "crown", "sole"].entries()) {
      await page.getByLabel("Vista de la foto").selectOption(imageType);
      await page.getByLabel("Foto", { exact: true }).setInputFiles({
        name: `${imageType}.png`,
        mimeType: "image/png",
        buffer: tinyPng,
      });
      await page.getByRole("button", { name: "Agregar foto" }).click();
      await expect(page.locator("main article img")).toHaveCount(
        imageIndex + 1,
      );
    }
    await page.getByRole("link", { name: "Continuar a detalles" }).click();
    await page.getByLabel("Mano *").selectOption("right");
    await page.getByLabel("Flex *").selectOption("regular");
    await page.getByLabel("Loft (°) *").fill("9");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await page.getByLabel("Condición").selectOption("used");
    await page.getByLabel("Grado si es usado").selectOption("excellent");
    await page
      .getByLabel("Estado real")
      .fill("Marcas menores, sin daño estructural.");
    await page
      .getByLabel("Defectos declarados")
      .fill("Marca cosmética pequeña");
    await page
      .getByText("He declarado cualquier daño o defecto relevante.")
      .click();
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await page.getByLabel("Cantidad disponible").fill("1");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page.getByText("Lista para revisión")).toBeVisible();
    await page.getByRole("button", { name: "Enviar a Best Round" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/partner/publicaciones/${listingId}$`),
    );
    await expect(page.getByText(/Enviado · Versión 1/)).toBeVisible();

    const operationsContext = await browser.newContext();
    const operationsPage = await operationsContext.newPage();
    await login(
      operationsPage,
      operatorEmail,
      `/operacion/marketplace/publicaciones/${listingId}`,
    );
    await operationsPage
      .getByLabel("Marca si se crea")
      .selectOption({ label: "Titleist" });
    await operationsPage.getByLabel("Modelo canónico").fill("GT3 E2E");
    await operationsPage
      .getByLabel("Motivo de resolución")
      .fill("Identidad validada manualmente");
    await operationsPage
      .getByRole("button", { name: "Vincular producto" })
      .click();
    await expect(
      operationsPage.getByRole("heading", {
        name: "Resolver producto canónico",
      }),
    ).toHaveCount(0);
    await operationsPage.reload();
    await decide(operationsPage, "UNDER_REVIEW", "Revisión humana iniciada");
    await operationsPage.reload();
    await operationsPage
      .getByLabel("Decisión", { exact: true })
      .selectOption("CHANGES_REQUESTED");
    await operationsPage
      .getByLabel("Área si solicitas cambios")
      .selectOption("DESCRIPTION");
    await operationsPage
      .getByLabel("Comentario visible al Partner")
      .fill("Aclara que la marca es únicamente cosmética.");
    await operationsPage
      .getByLabel("Motivo de la decisión")
      .fill("La descripción necesita precisión");
    await operationsPage
      .getByLabel("Nota interna opcional")
      .fill("No compartir análisis interno");
    await operationsPage
      .getByRole("button", { name: "Guardar decisión" })
      .click();
    await expect(
      operationsPage.getByText(/· Cambios solicitados$/),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByText("Necesitamos que actualices información"),
    ).toBeVisible();
    await expect(
      page.getByText("Aclara que la marca es únicamente cosmética."),
    ).toBeVisible();
    await expect(page.getByText("No compartir análisis interno")).toHaveCount(
      0,
    );
    await page.getByRole("link", { name: "Continuar edición" }).click();
    await page
      .getByLabel("Descripción")
      .fill(
        "Driver usado; la única marca declarada es cosmética y no estructural.",
      );
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await page.goto(`/partner/publicaciones/${listingId}/revision`);
    await expect(page.getByText("Lista para revisión")).toBeVisible();
    await page.getByRole("button", { name: "Enviar a Best Round" }).click();
    await expect(page.getByText(/Enviado · Versión 2/)).toBeVisible();

    await operationsPage.goto(
      `/operacion/marketplace/publicaciones/${listingId}`,
    );
    await decide(operationsPage, "UNDER_REVIEW", "Segunda revisión iniciada");
    await operationsPage.reload();
    await decide(
      operationsPage,
      "APPROVED",
      "Versión dos aprobada por Operations",
    );
    await operationsContext.close();

    await page.reload();
    await expect(page.getByText(/Aprobado · Versión 2/)).toBeVisible();
    await expect(
      page.getByText(
        "Aprobado por Best Round. Próximamente estará disponible para venta.",
      ),
    ).toBeVisible();
    await expect(page.getByText(/Comprar|Agregar al carrito/)).toHaveCount(0);

    const forbidden = await page.goto(
      `/partner/publicaciones/${partnerBListingId}`,
    );
    expect(forbidden?.status()).toBe(404);
  });

  test("non-VERIFIED Partner cannot create or submit listings", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Negative authorization runs once on Desktop.");
    await login(page, pendingEmail, "/partner/publicaciones");
    await expect(page.getByText("Verificación requerida")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Publicar un producto" }),
    ).toHaveCount(0);
    await page.goto("/partner/publicaciones/nueva");
    await expect(page).toHaveURL(/\/partner\/verificacion(?:\?|$)/);
    await expect(
      page.getByRole("heading", { name: "Verificación" }),
    ).toBeVisible();
  });

  test("listing wizard remains usable on phone viewports", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive listing coverage.");
    await login(page, partnerEmail, "/partner/publicaciones/nueva");
    await expect(
      page.getByRole("heading", { name: "¿Qué estás vendiendo?" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByLabel("Categoría").selectOption({ label: "Driver" });
    await page.getByRole("button", { name: "Crear borrador" }).click();
    await page.getByRole("link", { name: "Fotos" }).click();
    await expect(page.getByLabel("Foto", { exact: true })).toHaveAttribute(
      "capture",
      "environment",
    );
    await expectNoHorizontalOverflow(page);
  });
});

async function decide(page: Page, status: string, reason: string) {
  await page.getByLabel("Decisión", { exact: true }).selectOption(status);
  await page.getByLabel("Motivo de la decisión").fill(reason);
  await page.getByRole("button", { name: "Guardar decisión" }).click();
  const label = status === "UNDER_REVIEW" ? "En revisión" : "Aprobado";
  await expect(page.getByText(new RegExp(`· ${label}$`))).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => {
    window.scrollTo(10_000, 0);
    const pageScrollX = window.scrollX;
    window.scrollTo(0, 0);
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      pageScrollX,
      navigation: (() => {
        const navigation = document.querySelector<HTMLElement>(
          'nav[aria-label="Portal Partner"]',
        );
        return navigation
          ? {
              clientWidth: navigation.clientWidth,
              scrollWidth: navigation.scrollWidth,
              overflowX: getComputedStyle(navigation).overflowX,
            }
          : null;
      })(),
    };
  });
  expect(result.pageScrollX, JSON.stringify(result)).toBe(0);
}

async function login(page: Page, email: string, next: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

function prepareListingUsers() {
  sql(`
    update public.site_settings set value = '{"enabled":true}'::jsonb
    where key = 'marketplace.enabled';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000','43000000-0000-4000-8000-000000000001','authenticated','authenticated','${partnerEmail}',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Lina","last_name":"Listings"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','43000000-0000-4000-8000-000000000002','authenticated','authenticated','partner-b-listings@example.test',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Beto","last_name":"Listings"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','43000000-0000-4000-8000-000000000003','authenticated','authenticated','${operatorEmail}',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Olivia","last_name":"Listings"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','43000000-0000-4000-8000-000000000004','authenticated','authenticated','${pendingEmail}',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Pablo","last_name":"Pending"}',now(),now());
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now()
    from auth.users where id::text like '43000000-0000-4000-8000-00000000000%';
    insert into public.user_roles (user_id, role_id)
    select '43000000-0000-4000-8000-000000000003', id from public.roles where name = 'operator';
    insert into public.brands (id, slug, name)
    values ('43000000-0000-4000-8000-000000000201','e2e-listings-titleist','Titleist');
    insert into public.partner_profiles (id, user_id, legal_type, status, verified_at, first_name, last_name)
    values
      ('43000000-0000-4000-8000-000000000101','43000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now(),'Lina','Listings'),
      ('43000000-0000-4000-8000-000000000102','43000000-0000-4000-8000-000000000002','INDIVIDUAL','VERIFIED',now(),'Beto','Listings'),
      ('43000000-0000-4000-8000-000000000104','43000000-0000-4000-8000-000000000004','INDIVIDUAL','REGISTERED',null,'Pablo','Pending');
    insert into public.marketplace_listings (id, partner_id)
    values ('${partnerBListingId}','43000000-0000-4000-8000-000000000102');
    insert into public.marketplace_listing_versions (
      id, listing_id, version_number, category_id, proposed_brand,
      proposed_model, title, description, created_by
    ) values (
      '43000000-0000-4000-8000-000000000011','${partnerBListingId}',1,
      (select id from public.categories where slug = 'driver' limit 1),
      'Private','Partner B','Private listing B','Must remain private',
      '43000000-0000-4000-8000-000000000002'
    );
    update public.marketplace_listings
    set current_version_id = '43000000-0000-4000-8000-000000000011'
    where id = '${partnerBListingId}';
  `);
}

function sql(statement: string) {
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_peter-golf-mvp",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { stdio: "ignore" },
  );
}
