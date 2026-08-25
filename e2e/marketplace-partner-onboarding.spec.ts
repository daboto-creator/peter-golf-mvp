import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_E2E === "1";
const password = "PartnerE2E123!";
const partnerEmail = "e2e.marketplace.partner@example.test";
const operatorEmail = "e2e.marketplace.operator@example.test";
const golferEmail = "e2e.marketplace.golfer@example.test";
const partnerBId = "42000000-0000-4000-8000-000000000002";

test.describe("Marketplace Partner onboarding @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_E2E=1 and MARKETPLACE_ENABLED=true.",
  );
  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    prepareUsers();
  });

  test("Golfer completes onboarding, Operations verifies, and modes remain one session", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating transaction runs once on Desktop.");
    await login(page, partnerEmail, "/cuenta");
    await expect(
      page.getByRole("link", { name: "Quiero vender en Best Round" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Quiero vender en Best Round" })
      .click();
    await page.getByRole("link", { name: "Comenzar" }).click();
    await page.getByLabel(/Particular/).check();
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page).toHaveURL(/\/partner\/onboarding\/datos$/);
    await page.getByLabel("Nombre *").fill("Ana");
    await page.getByLabel("Apellido *").fill("Partner");
    await page.getByLabel("Teléfono *").fill("5512345678");
    await page.getByLabel("Estado *").fill("Jalisco");
    await page.getByLabel("Ciudad *").fill("Guadalajara");
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page).toHaveURL(/\/partner\/onboarding\/fiscal$/);
    await page.getByRole("button", { name: "Guardar y continuar" }).click();
    await expect(page).toHaveURL(/\/partner\/onboarding\/documentos$/);
    await page.getByLabel("Tipo de documento").selectOption("identification");
    await page.getByLabel("Archivo privado").setInputFiles({
      name: "identificacion.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nE2E"),
    });
    await page.getByRole("button", { name: "Subir documento" }).click();
    await expect(
      page.getByText("Documento recibido de forma segura."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Continuar a revisión" }).click();
    await page.getByRole("button", { name: "Enviar a revisión" }).click();
    await expect(page).toHaveURL(/\/partner$/);
    await expect(
      page.getByText("Estamos revisando tu información").first(),
    ).toBeVisible();

    const operationsContext = await browser.newContext();
    const operationsPage = await operationsContext.newPage();
    await login(
      operationsPage,
      operatorEmail,
      "/operacion/marketplace/partners",
    );
    await operationsPage.getByRole("link", { name: "Revisar" }).first().click();
    await operationsPage.getByLabel("Decisión").selectOption("VERIFIED");
    await operationsPage
      .getByLabel("Motivo")
      .first()
      .fill("Documento válido para revisión MVP");
    await operationsPage
      .getByRole("button", { name: "Guardar revisión" })
      .click();
    await expect(
      operationsPage.getByText("Revisión de documento guardada."),
    ).toBeVisible();
    await operationsPage.getByLabel("Nuevo estado").selectOption("VERIFIED");
    await operationsPage
      .getByLabel("Motivo obligatorio")
      .fill("Identidad y documento revisados");
    await operationsPage
      .getByRole("button", { name: "Actualizar estado" })
      .click();
    await expect(
      operationsPage.getByText("Estado Partner actualizado."),
    ).toBeVisible();
    await operationsContext.close();

    await page.reload();
    await expect(page.getByText("Partner verificado").first()).toBeVisible();
    await expect(
      page.getByText(
        "La publicación de productos estará disponible próximamente.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Modo Golfer" }).click();
    await expect(page).toHaveURL(/\/cuenta$/);
    await page.getByRole("button", { name: "Modo Partner" }).click();
    await expect(page).toHaveURL(/\/partner$/);

    const forbiddenResponse = await page.goto(
      `/operacion/marketplace/partners/${partnerBId}`,
    );
    expect(forbiddenResponse?.status()).toBe(403);
  });

  test("Golfer without Partner cannot open Operations", async ({ page }) => {
    await login(page, golferEmail, "/cuenta");
    const response = await page.goto("/operacion/marketplace/partners");
    expect(response?.status()).toBe(403);
  });

  test("Partner onboarding shell is usable without horizontal overflow on mobile", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive Partner coverage.");
    await login(page, partnerEmail, "/cuenta");
    await page
      .getByRole("link", { name: "Quiero vender en Best Round" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Conviértete en Best Round Partner" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("link", { name: "Comenzar" }).click();
    await expect(page.getByText("Paso 1 de 5")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

async function login(page: Page, email: string, next: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

function prepareUsers() {
  sql(`
    update public.site_settings set value = '{"enabled":true}'::jsonb
    where key = 'marketplace.enabled';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000','42000000-0000-4000-8000-000000000001','authenticated','authenticated','${partnerEmail}',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Ana","last_name":"Partner"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','42000000-0000-4000-8000-000000000002','authenticated','authenticated','e2e.marketplace.partner-b@example.test',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Beto","last_name":"Partner"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','42000000-0000-4000-8000-000000000003','authenticated','authenticated','${operatorEmail}',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Olivia","last_name":"Operations"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','42000000-0000-4000-8000-000000000004','authenticated','authenticated','${golferEmail}',extensions.crypt('${password}', extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Gaby","last_name":"Golfer"}',now(),now());
    insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
    select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now()
    from auth.users where id in ('42000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000004');
    insert into public.user_roles (user_id, role_id)
    select '42000000-0000-4000-8000-000000000003', id from public.roles where name = 'operator';
    insert into public.partner_profiles (id, user_id, legal_type)
    values ('${partnerBId}', '42000000-0000-4000-8000-000000000002', 'INDIVIDUAL');
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
