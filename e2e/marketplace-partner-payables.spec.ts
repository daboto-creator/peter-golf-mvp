import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_PAYABLES_E2E === "1";
const password = "PayablesE2E123!";
const partnerEmail = "e2e.marketplace.payables@example.test";
const operatorEmail = "e2e.marketplace.payables-operator@example.test";

test.describe("Marketplace Partner payables @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_PAYABLES_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    preparePayablesScenario();
  });

  test("Partner sees only own balance and Operations records hold, release and reversal", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating finance path runs once on Desktop.");
    await login(page, partnerEmail, "/partner/pagos");
    await expect(
      page.getByRole("heading", { name: "Pagos", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Saldo pendiente", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Partner B Driver")).toHaveCount(0);

    const payableId = sqlValue(
      "select id from public.marketplace_partner_payables where partner_id='6b000000-0000-4000-8000-000000000001'",
    );
    const operations = await browser.newContext();
    const operationsPage = await operations.newPage();
    await login(
      operationsPage,
      operatorEmail,
      `/operacion/marketplace/pagos/${payableId}`,
    );
    await expect(
      operationsPage.getByRole("heading", { name: "Obligación Partner" }),
    ).toBeVisible();
    await expect(operationsPage.getByText("Snapshot inmutable")).toBeVisible();

    const holdForm = operationsPage
      .getByRole("button", { name: "Poner hold" })
      .locator("xpath=ancestor::form");
    await holdForm.getByLabel("Mostrar motivo al Partner").check();
    await holdForm
      .getByLabel("Motivo", { exact: true })
      .fill("Revisión visible E2E");
    await holdForm.getByRole("button", { name: "Poner hold" }).click();
    await expect(operationsPage.getByText("Hold registrado.")).toBeVisible();

    await page.reload();
    await expect(
      page.getByText("En revisión", { exact: true }).first(),
    ).toBeVisible();

    const releaseHoldForm = operationsPage
      .getByRole("button", { name: "Liberar OPERATIONS" })
      .locator("xpath=ancestor::form");
    await releaseHoldForm
      .getByLabel("Motivo", { exact: true })
      .fill("Revisión E2E completada");
    await releaseHoldForm
      .getByRole("button", { name: "Liberar OPERATIONS" })
      .click();
    await expect(
      operationsPage.getByRole("button", { name: "Liberar OPERATIONS" }),
    ).toHaveCount(0);
    await expect(operationsPage.getByText(/^PENDING · versión/)).toBeVisible();

    const releaseForm = operationsPage
      .getByRole("button", { name: "Liberar saldo" })
      .locator("xpath=ancestor::form");
    await releaseForm
      .getByLabel("Motivo", { exact: true })
      .fill("Entrega aceptada en E2E");
    await releaseForm.getByRole("button", { name: "Liberar saldo" }).click();
    await expect(
      operationsPage.getByText(/^AVAILABLE · versión/),
    ).toBeVisible();

    const reverseForm = operationsPage
      .getByRole("button", { name: "Registrar reversión" })
      .locator("xpath=ancestor::form");
    await reverseForm.getByLabel("Monto a revertir (centavos)").fill("100");
    await reverseForm
      .getByLabel("Motivo", { exact: true })
      .fill("Ajuste parcial E2E");
    await reverseForm
      .getByRole("button", { name: "Registrar reversión" })
      .click();
    await expect(
      operationsPage.getByText("Reversión compensatoria registrada."),
    ).toBeVisible();
    expect(
      sqlValue(
        `select status||'|'||reversed_amount_cents||'|'||(select count(*) from public.marketplace_partner_ledger_entries where payable_id='${payableId}') from public.marketplace_partner_payables where id='${payableId}'`,
      ),
    ).toMatch(/^AVAILABLE\|100\|[4-9][0-9]*$/);
    await operations.close();
  });

  test("Partner payments has no horizontal overflow on phones", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive Partner payments coverage.");
    await login(page, partnerEmail, "/partner/pagos");
    await expect(
      page.getByRole("heading", { name: "Pagos", exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      x: window.scrollX,
    }));
    expect(overflow.x, JSON.stringify(overflow)).toBe(0);
    expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
  });
});

async function login(page: Page, email: string, next: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

function preparePayablesScenario() {
  const fixture = readFileSync(
    "supabase/tests/marketplace_checkout_orders_fulfillment.sql",
    "utf8",
  ).replace(/rollback;\s*$/m, "commit;");
  psql(fixture);
  sql(`
    insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      confirmation_token,recovery_token,email_change_token_new,email_change,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
      ('00000000-0000-0000-0000-000000000000','73000000-0000-4000-8000-000000000001','authenticated','authenticated','${partnerEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','73000000-0000-4000-8000-000000000002','authenticated','authenticated','${operatorEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now());
    insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
    select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
    from auth.users where id in ('73000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002');
    update public.partner_profiles set user_id='73000000-0000-4000-8000-000000000001'
      where id='6b000000-0000-4000-8000-000000000001';
    insert into public.user_roles(user_id,role_id)
      select '73000000-0000-4000-8000-000000000002',id from public.roles where name='operator';
    alter table public.order_fulfillments disable trigger order_fulfillments_sync_order;
    select set_config('peter_golf.marketplace_order_write','enabled',true);
    update public.order_fulfillments set status='ACCEPTANCE_PENDING',version=version+1
      where partner_id='6b000000-0000-4000-8000-000000000001';
    select set_config('peter_golf.marketplace_order_write','disabled',true);
    alter table public.order_fulfillments enable trigger order_fulfillments_sync_order;
  `);
}

function psql(statement: string) {
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_peter-golf-mvp",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: statement, stdio: ["pipe", "ignore", "inherit"] },
  );
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

function sqlValue(statement: string): string {
  return execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_peter-golf-mvp",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  ).trim();
}
