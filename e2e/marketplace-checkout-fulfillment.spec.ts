import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const fulfillmentEnabled = process.env.RUN_MARKETPLACE_CHECKOUT_E2E === "1";
const fulfillmentPassword = "FulfillmentE2E123!";

test.describe("Marketplace checkout, fulfillment and Partner finance security shell", () => {
  for (const path of [
    "/partner/ventas",
    "/partner/pagos",
    "/operacion/marketplace/ordenes",
    "/operacion/marketplace/pagos",
  ]) {
    test(`${path} blocks anonymous access without a runtime error`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/iniciar-sesion");
      await expect(page.locator("body")).not.toContainText(
        /Internal Server Error|Application error/i,
      );
    });
  }

  test("Marketplace remains absent from the public catalog", async ({
    page,
  }) => {
    await page.goto("/productos");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByText(/Vendido por un Best Round Partner verificado/i),
    ).toHaveCount(0);
  });
});

test.describe("Partner shipping handoff @mutating", () => {
  test.skip(
    !fulfillmentEnabled,
    "Set RUN_MARKETPLACE_CHECKOUT_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    execFileSync(
      "curl",
      [
        "-fsS",
        "--retry",
        "20",
        "--retry-delay",
        "1",
        "http://127.0.0.1:54321/auth/v1/health",
      ],
      { stdio: "ignore" },
    );
    prepareFulfillmentScenario();
  });

  test("Partner moves READY_FOR_CARRIER to SHIPPED with tracking", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating handoff runs once on Desktop.");
    test.setTimeout(60_000);
    const fulfillmentId = sqlValue(
      "select id from public.order_fulfillments where partner_id='6b000000-0000-4000-8000-000000000001'",
    );
    await login(
      page,
      "checkout-partner-a@example.test",
      `/partner/ventas/${fulfillmentId}`,
    );
    await page.getByRole("button", { name: "Confirmar existencia" }).click();
    await page.getByRole("button", { name: "Preparar envío" }).click();
    await page.getByRole("button", { name: "Marcar listo" }).click();
    await expect(
      page.getByRole("heading", { name: "Tu producto está listo para enviar" }),
    ).toBeVisible();
    await page
      .getByLabel("Transportista", { exact: true })
      .fill("Paquetería E2E");
    await page.getByLabel("Número de guía / tracking").fill("E2E-TRACK-001");
    const handoffLocal = await page.evaluate(() => {
      const date = new Date(Date.now() - 60 * 60 * 1000);
      const offset = date.getTimezoneOffset() * 60_000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 16);
    });
    await page
      .getByLabel("Fecha y hora de entrega al transportista")
      .fill(handoffLocal);
    await page.getByLabel("Nota opcional").fill("Entregado en mostrador");
    await page.getByRole("button", { name: "Confirmar envío" }).click();
    await expect(page.getByText("Estado: Enviado")).toBeVisible();
    await expect(page.getByText("E2E-TRACK-001")).toBeVisible();
    expect(
      sqlValue(
        `select status||'|'||carrier||'|'||tracking_number||'|'||(shipped_at is not null)::text from public.order_fulfillments where id='${fulfillmentId}'`,
      ),
    ).toBe("SHIPPED|Paquetería E2E|E2E-TRACK-001|true");
  });
});

async function login(page: Page, email: string, next: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(fulfillmentPassword);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

function prepareFulfillmentScenario() {
  const source = readFileSync(
    "supabase/tests/marketplace_checkout_orders_fulfillment.sql",
    "utf8",
  );
  const fixture = `${source.slice(0, source.indexOf("-- Partner A sees"))}\ncommit;`;
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
    { input: fixture, stdio: ["pipe", "ignore", "inherit"] },
  );
  sql(`
    update auth.users set
      instance_id='00000000-0000-0000-0000-000000000000',
      encrypted_password=extensions.crypt('${fulfillmentPassword}',extensions.gen_salt('bf')),
      email_confirmed_at=now(),
      raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
      confirmation_token='',recovery_token='',email_change_token_new='',email_change='',
      aud='authenticated',role='authenticated',updated_at=now()
    where id='6a000000-0000-4000-8000-000000000001';
    insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
    select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
    from auth.users where id='6a000000-0000-4000-8000-000000000001'
    on conflict(provider_id,provider) do nothing;
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
