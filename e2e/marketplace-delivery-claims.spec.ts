import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_CLAIMS_E2E === "1";
const password = "ClaimsE2E123!";
const buyerEmail = "checkout-buyer-a@example.test";
const operatorEmail = "checkout-operator@example.test";

test.describe("Marketplace delivery acceptance and claims @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_CLAIMS_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    prepareScenario();
  });

  test("buyer accepts one delivery and reports another without a financial race", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Mutating acceptance path runs once on Desktop.");
    const orderId = sqlValue(
      "select id from public.orders where user_id='6a000000-0000-4000-8000-000000000003' order by created_at limit 1",
    );
    await login(page, buyerEmail, `/cuenta/pedidos/${orderId}`);
    await expect(page.getByRole("heading", { name: /PG-/ })).toBeVisible();
    const accept = page.getByRole("button", { name: "Todo correcto" }).first();
    await accept.click();
    await expect(
      page.getByText(
        "Al confirmar, indicas que recibiste el producto conforme a la publicación y Best Round podrá continuar con el pago al Partner.",
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Confirmar que todo está correcto" })
      .click();
    await expect(page.getByText("Estado: BUYER_ACCEPTED")).toBeVisible();

    const problem = page.getByRole("button", { name: "Enviar a Best Round" });
    const form = problem.locator("xpath=ancestor::form");
    await form.getByRole("combobox").selectOption("WRONG_SPECS");
    await form
      .getByPlaceholder("Describe brevemente qué ocurrió")
      .fill("El loft recibido no coincide con el snapshot de compra.");
    await problem.click();
    await expect(page.getByText("Estado: En revisión")).toBeVisible();
    expect(
      sqlValue(
        "select count(*)||'|'||(select count(*) from public.marketplace_partner_holds where source='CLAIM' and status='ACTIVE') from public.marketplace_claims",
      ),
    ).toBe("1|1");
  });

  test("Partner sees only own mediated claim and Operations resolves it", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "Mutating resolution path runs once on Desktop.");
    const fulfillmentId = sqlValue(
      "select fulfillment_id from public.marketplace_claims limit 1",
    );
    const claimPartnerEmail = sqlValue(
      "select u.email from public.marketplace_claims c join public.partner_profiles p on p.id=c.partner_id join auth.users u on u.id=p.user_id limit 1",
    );
    await login(page, claimPartnerEmail, `/partner/ventas/${fulfillmentId}`);
    await expect(page.getByText("Reclamo en revisión")).toBeVisible();
    await expect(page.getByText(/correo|teléfono|tarjeta/i)).toHaveCount(0);

    const claimId = sqlValue(
      "select id from public.marketplace_claims limit 1",
    );
    const operations = await browser.newContext();
    const operationsPage = await operations.newPage();
    await login(
      operationsPage,
      operatorEmail,
      `/operacion/marketplace/reclamos/${claimId}`,
    );
    await expect(
      operationsPage.getByRole("heading", { name: "Resolución Marketplace" }),
    ).toBeVisible();
    const resolve = operationsPage.getByRole("button", {
      name: "Registrar resolución",
    });
    const form = resolve.locator("xpath=ancestor::form");
    await form.getByRole("combobox").nth(0).selectOption("REJECTED");
    await form.getByRole("combobox").nth(1).selectOption("NO_FAULT");
    await form
      .getByPlaceholder("Resumen de evidencia")
      .fill("Snapshot y evidencia revisados.");
    await form
      .getByPlaceholder("Resultado para el comprador")
      .fill("Reclamo no acreditado.");
    await form
      .getByPlaceholder("Motivo auditado")
      .fill("Las especificaciones coinciden con la compra.");
    await resolve.click();
    await expect(operationsPage.getByText("Resolución final")).toBeVisible();
    expect(
      sqlValue(
        `select c.status||'|'||p.status||'|'||(select count(*) from public.partner_score_events where source_entity_id=c.id) from public.marketplace_claims c join public.marketplace_partner_payables p on p.id=c.payable_id where c.id='${claimId}'`,
      ),
    ).toBe("RESOLVED|AVAILABLE|1");
    await operations.close();
  });

  test("buyer claim experience has no horizontal overflow on phones", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive buyer coverage.");
    const orderId = sqlValue(
      "select id from public.orders where user_id='6a000000-0000-4000-8000-000000000003' order by created_at limit 1",
    );
    await login(page, buyerEmail, `/cuenta/pedidos/${orderId}`);
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
  });

  test("hourly worker auto-accepts an expired delivery exactly once", async ({
    isMobile,
  }) => {
    test.skip(isMobile, "Mutating auto-accept path runs once on Desktop.");
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    prepareScenario();
    sql(`
      update public.marketplace_delivery_acceptances
        set delivered_at=now()-interval '49 hours',acceptance_deadline=now()-interval '1 hour'
        where id=(select id from public.marketplace_delivery_acceptances order by id limit 1);
      select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000005',false);
      set role authenticated;
      select public.run_marketplace_acceptance_job(now(),'e2e-auto-accept-hour');
      select public.run_marketplace_acceptance_job(now(),'e2e-auto-accept-hour');
      reset role;
    `);
    expect(
      sqlValue(
        "select count(*) filter(where status='AUTO_ACCEPTED')||'|'||(select count(*) from public.marketplace_acceptance_job_runs where execution_key='e2e-auto-accept-hour')||'|'||(select count(*) from public.marketplace_partner_payable_status_history where idempotency_key like 'payable:release:%') from public.marketplace_delivery_acceptances",
      ),
    ).toBe("1|1|1");
  });
});

test.describe("Marketplace claims public security shell", () => {
  for (const path of ["/partner/ventas", "/operacion/marketplace/reclamos"]) {
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

function prepareScenario() {
  const source = readFileSync(
    "supabase/tests/marketplace_checkout_orders_fulfillment.sql",
    "utf8",
  );
  const fixture = `${source.slice(0, source.indexOf("-- Partner A sees"))}\ncommit;`;
  psql(fixture);
  sql(`
    update auth.users set instance_id='00000000-0000-0000-0000-000000000000',
      encrypted_password=extensions.crypt('${password}',extensions.gen_salt('bf')),email_confirmed_at=now(),
      raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
      confirmation_token='',recovery_token='',email_change_token_new='',email_change='',
      aud='authenticated',role='authenticated',updated_at=now()
      where id in('6a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000002','6a000000-0000-4000-8000-000000000003','6a000000-0000-4000-8000-000000000005');
    insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
      select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
      from auth.users where id in('6a000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000002','6a000000-0000-4000-8000-000000000003','6a000000-0000-4000-8000-000000000005')
      on conflict(provider_id,provider) do nothing;
    alter table public.order_fulfillments disable trigger order_fulfillments_sync_order;
    select set_config('peter_golf.marketplace_order_write','enabled',false);
    update public.order_fulfillments set status='SHIPPED',shipped_at=now()-interval '2 days',version=version+1
      where order_id=(select id from public.orders where user_id='6a000000-0000-4000-8000-000000000003' order by created_at limit 1) and source='PARTNER';
    select set_config('peter_golf.marketplace_order_write','disabled',false);
    alter table public.order_fulfillments enable trigger order_fulfillments_sync_order;
    select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000005',false);
    set role authenticated;
    select public.record_marketplace_delivery(id,now()-interval '1 hour','Entrega confirmada E2E',gen_random_uuid())
      from public.order_fulfillments where order_id=(select id from public.orders where user_id='6a000000-0000-4000-8000-000000000003' order by created_at limit 1) and source='PARTNER';
    reset role;
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
