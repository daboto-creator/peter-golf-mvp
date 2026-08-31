import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_PAYOUTS_E2E === "1";
const password = "PayoutsE2E123!";
const partnerEmail = "checkout-partner-a@example.test";
const operatorEmail = "checkout-operator@example.test";

test.describe("Marketplace Partner payouts @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_PAYOUTS_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    const fixture = readFileSync(
      "supabase/tests/marketplace_checkout_orders_fulfillment.sql",
      "utf8",
    ).replace(/rollback;\s*$/m, "commit;");
    psql(fixture);
    sql(`
      update auth.users set instance_id='00000000-0000-0000-0000-000000000000',
        encrypted_password=extensions.crypt('${password}',extensions.gen_salt('bf')),email_confirmed_at=now(),
        raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
        confirmation_token='',recovery_token='',email_change_token_new='',email_change='',updated_at=now()
      where id in('6a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000005');
      insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
      select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
      from auth.users where id in('6a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000005')
      on conflict(provider_id,provider) do nothing;
    `);
  });

  test("Partner sees own paid payout and Operations sees immutable settlement", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "The settlement detail path runs once on Desktop.");
    await login(page, partnerEmail, "/partner/pagos");
    await expect(page.getByText("Próximos pagos")).toBeVisible();
    await expect(
      page.getByText("Pagado", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Withdraw|Cash out|Solicitar transferencia/i),
    ).toHaveCount(0);

    const payoutId = sqlValue(
      "select id from public.marketplace_partner_payouts where status='PAID' limit 1",
    );
    const operations = await browser.newContext();
    const operationsPage = await operations.newPage();
    await login(
      operationsPage,
      operatorEmail,
      `/operacion/marketplace/payouts/${payoutId}`,
    );
    await expect(
      operationsPage.getByRole("heading", { name: "Payout Partner" }),
    ).toBeVisible();
    await expect(
      operationsPage.getByText("Settlement: CONFIRMED"),
    ).toBeVisible();
    await expect(
      operationsPage.getByText(/sólo registra evidencia de una transferencia/i),
    ).toBeVisible();
    await operations.close();
  });

  test("Partner payouts stays responsive on phones", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive payout coverage.");
    await login(page, partnerEmail, "/partner/pagos");
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
  });
});

test.describe("Marketplace payouts public security shell", () => {
  for (const path of ["/partner/pagos", "/operacion/marketplace/payouts"]) {
    test(`${path} blocks anonymous access safely`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/iniciar-sesion");
      await expect(page.locator("body")).not.toContainText(
        /Internal Server Error|Application error/i,
      );
    });
  }
});

async function login(page: Page, email: string, next: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
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

function sqlValue(statement: string) {
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
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  ).trim();
}
