import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_SCORE_TIERS_E2E === "1";
const password = "ScoreTiersE2E123!";
const partnerEmail = "e2e.marketplace.score@example.test";
const adminEmail = "e2e.marketplace.score-admin@example.test";
const partnerId = "44000000-0000-4000-8000-000000000101";

test.describe("Marketplace Partner Score and Tiers @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_SCORE_TIERS_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    prepareScoreUsers();
  });

  test("Partner sees provisional Score and Operations applies audited overrides", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating Operations flow runs once on Desktop.");
    await login(page, partnerEmail, "/partner/score");
    await expect(
      page.getByRole("heading", { name: "Tu Score y nivel" }),
    ).toBeVisible();
    await expect(page.getByText("Best Round Partner Nuevo")).toBeVisible();
    await expect(page.getByTestId("partner-score-value")).toContainText("80");
    await expect(page.getByText("Bogey", { exact: true })).toBeVisible();

    const operations = await browser.newContext();
    const operationsPage = await operations.newPage();
    await login(
      operationsPage,
      adminEmail,
      `/operacion/marketplace/partners/${partnerId}/score`,
    );
    await expect(
      operationsPage.getByRole("heading", { name: "Sofía Score" }),
    ).toBeVisible();
    await expect(
      operationsPage.getByText("Componentes auditables"),
    ).toBeVisible();

    await operationsPage.getByLabel("Tipo").selectOption("SCORE");
    await operationsPage.getByLabel("Score 0–100").fill("86");
    await operationsPage
      .getByLabel("Motivo obligatorio")
      .fill("Escenario E2E aprobado de Score");
    await operationsPage
      .getByRole("button", { name: "Crear override" })
      .click();
    await expect(operationsPage.getByText(/Override registrado/)).toBeVisible();

    await operationsPage.getByLabel("Tipo").selectOption("TIER");
    await operationsPage.getByLabel("Tier").selectOption("BIRDIE");
    await operationsPage
      .getByLabel("Motivo obligatorio")
      .fill("Escenario E2E aprobado de Tier");
    await operationsPage
      .getByRole("button", { name: "Crear override" })
      .click();
    await expect(operationsPage.getByText(/Override registrado/)).toBeVisible();

    await operationsPage
      .getByLabel("Motivo", { exact: true })
      .fill("Aplicar overrides del escenario E2E");
    await operationsPage
      .getByRole("button", { name: "Recalcular Score" })
      .click();
    await expect(operationsPage.getByText(/Score recalculado/)).toBeVisible();
    await operations.close();

    await page.reload();
    await expect(page.getByText("Birdie", { exact: true })).toBeVisible();
    await expect(page.getByTestId("partner-score-value")).toContainText("86");
    await expect(page.getByText(/Comprar|Agregar al carrito/)).toHaveCount(0);
  });

  test("Score and Tier explanation has no horizontal overflow on phones", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive Score/Tier coverage.");
    await login(page, partnerEmail, "/partner/score");
    await expect(page.getByText("Best Round Partner Nuevo")).toBeVisible();
    const overflow = await page.evaluate(() => {
      window.scrollTo(10_000, 0);
      return {
        x: window.scrollX,
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      };
    });
    expect(overflow.x, JSON.stringify(overflow)).toBe(0);
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

function prepareScoreUsers() {
  sql(`
    update public.site_settings set value = '{"enabled":true}'::jsonb where key = 'marketplace.enabled';
    insert into auth.users (
      instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      confirmation_token,recovery_token,email_change_token_new,email_change,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    ) values
      ('00000000-0000-0000-0000-000000000000','44000000-0000-4000-8000-000000000001','authenticated','authenticated','${partnerEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Sofía","last_name":"Score"}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','44000000-0000-4000-8000-000000000002','authenticated','authenticated','${adminEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{"first_name":"Ada","last_name":"Score"}',now(),now());
    insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at)
    select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
    from auth.users where id::text like '44000000-0000-4000-8000-00000000000%';
    insert into public.user_roles (user_id,role_id)
    select '44000000-0000-4000-8000-000000000002',id from public.roles where name='admin';
    insert into public.partner_profiles (id,user_id,legal_type,status,first_name,last_name)
    values ('${partnerId}','44000000-0000-4000-8000-000000000001','INDIVIDUAL','REGISTERED','Sofía','Score');
    update public.partner_profiles set status='VERIFIED',verified_at=now(),version=version+1 where id='${partnerId}';
    insert into public.partner_status_history (partner_id,from_status,to_status,reason,version)
    values ('${partnerId}','REGISTERED','VERIFIED','E2E Partner verification',2);
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
