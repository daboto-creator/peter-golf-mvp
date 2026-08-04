import { execFileSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";
import { expect, test, type APIRequestContext } from "@playwright/test";

loadEnvConfig(process.cwd());

const enabled = process.env.RUN_NOTIFICATION_E2E === "1";
const mode = process.env.NOTIFICATIONS_MODE ?? "disabled";
const inboxUrl = "http://127.0.0.1:54324";
const password = "Notificacion123!";

test.describe("local order notifications", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !enabled,
    "Set RUN_NOTIFICATION_E2E=1; this suite resets Supabase local.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    prepareOperator();
  });

  test("disabled mode does not claim deliveries", async ({ page }) => {
    test.skip(mode !== "disabled", "Run with NOTIFICATIONS_MODE=disabled.");
    await login(page);
    await page.goto("/operacion/notificaciones");
    await expect(
      page.getByRole("button", { name: "Procesar pendientes" }),
    ).toBeDisabled();
  });

  test("processes an event into Inbucket and blocks a real domain", async ({
    page,
    request,
  }) => {
    test.skip(mode !== "test", "Run with NOTIFICATIONS_MODE=test.");
    createOrder(
      "77000000-0000-4000-8000-000000000001",
      "PG-W-E2E-000001",
      "e2e.operator@example.test",
    );
    createOrder(
      "77000000-0000-4000-8000-000000000002",
      "PG-W-E2E-000002",
      "blocked@example.com",
    );
    await login(page);
    await page.goto("/operacion/notificaciones");
    await page.getByRole("button", { name: "Procesar pendientes" }).click();
    await expect(page.getByText(/1 enviadas y 1 fallidas/)).toBeVisible();
    await expect
      .poll(() => inboxContains(request, "PG-W-E2E-000001"))
      .toBe(true);
    await expect(page.getByText("recipient_domain_not_allowed")).toBeVisible();
  });

  test("records an SMTP outage and retries after recovery", async ({
    page,
    request,
  }) => {
    test.skip(mode !== "test", "Run with NOTIFICATIONS_MODE=test.");
    createOrder(
      "77000000-0000-4000-8000-000000000003",
      "PG-W-E2E-000003",
      "e2e.operator@example.test",
    );
    await login(page);
    await page.goto("/operacion/notificaciones");
    execFileSync("docker", ["stop", "supabase_inbucket_peter-golf-mvp"], {
      stdio: "ignore",
    });
    try {
      await page.getByRole("button", { name: "Procesar pendientes" }).click();
      await expect(page.getByText(/0 enviadas y 1 fallidas/)).toBeVisible();
      await expect(page.getByText("smtp_unavailable")).toBeVisible();
    } finally {
      execFileSync("docker", ["start", "supabase_inbucket_peter-golf-mvp"], {
        stdio: "ignore",
      });
    }
    await expect.poll(() => inboxAvailable(request)).toBe(true);
    await page.getByRole("button", { name: "Reintentar fallidas" }).click();
    await expect
      .poll(() => inboxContains(request, "PG-W-E2E-000003"))
      .toBe(true);
  });
});

async function login(page: import("@playwright/test").Page) {
  await page.goto("/iniciar-sesion?next=/operacion/notificaciones");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
  await page.getByLabel("Correo electrónico").fill("e2e.operator@example.test");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(
    (url) => url.pathname === "/operacion/notificaciones",
  );
}

async function inboxContains(request: APIRequestContext, orderNumber: string) {
  try {
    const response = await request.get(`${inboxUrl}/api/v1/messages`);
    if (!response.ok()) return false;
    const body = (await response.json()) as {
      messages?: { Subject?: string }[];
    };
    return (
      body.messages?.some((message) =>
        message.Subject?.includes(orderNumber),
      ) ?? false
    );
  } catch {
    return false;
  }
}

async function inboxAvailable(request: APIRequestContext) {
  try {
    return (await request.get(inboxUrl)).ok();
  } catch {
    return false;
  }
}

function prepareOperator() {
  sql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '17000000-0000-4000-8000-000000000001','authenticated','authenticated',
      'e2e.operator@example.test',
      extensions.crypt('${password}', extensions.gen_salt('bf')),now(),
      '','','','',
      '{"provider":"email","providers":["email"]}',
      '{"first_name":"Operador","last_name":"E2E"}',now(),now()
    );
    insert into public.user_roles (user_id, role_id)
    select '17000000-0000-4000-8000-000000000001', id
    from public.roles where name = 'operator';
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      '17000000-0000-4000-8000-000000000001',
      '17000000-0000-4000-8000-000000000001',
      '{"sub":"17000000-0000-4000-8000-000000000001","email":"e2e.operator@example.test","email_verified":true}',
      'email',now(),now()
    );
  `);
}

function createOrder(id: string, orderNumber: string, email: string) {
  sql(`
    insert into public.orders (
      id, order_number, user_id, status, subtotal, total,
      shipping_address_snapshot, customer_name, customer_email,
      customer_phone, origin
    ) values (
      '${id}','${orderNumber}','17000000-0000-4000-8000-000000000001',
      'pending_confirmation',12500,12500,
      '{"recipient_name":"Operador","street":"Prueba"}',
      'Operador E2E','${email}','4420000000','web'
    );
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
