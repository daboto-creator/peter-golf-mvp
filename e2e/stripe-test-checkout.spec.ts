import { execFileSync } from "node:child_process";

import { loadEnvConfig } from "@next/env";
import { expect, test } from "@playwright/test";

loadEnvConfig(process.cwd());

const enabled = process.env.RUN_STRIPE_E2E === "1";
const configured =
  process.env.PAYMENTS_MODE === "test" &&
  process.env.STRIPE_CHECKOUT_MODE === "test" &&
  process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") &&
  process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
const password = "StripeE2E123!";

test.describe("local Stripe Checkout test @mutating", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !enabled || !configured,
    "Set RUN_STRIPE_E2E=1 and the complete local Stripe test configuration.",
  );

  test.beforeAll(() => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    seedStripeCustomerOrders();
  });

  test("waits for operational confirmation before enabling Stripe", async ({
    page,
  }) => {
    await login(page, "/cuenta/pedidos/78000000-0000-4000-8000-000000000001");
    await expect(page.getByText("Pendiente de confirmación")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pagar con tarjeta de prueba" }),
    ).toBeDisabled();
  });

  test("creates one hosted test Checkout session from a confirmed order", async ({
    page,
  }) => {
    await login(page, "/cuenta/pedidos/78000000-0000-4000-8000-000000000002");
    await expect(page.getByText("Listo para pagar")).toBeVisible();
    await page
      .getByRole("button", { name: "Pagar con tarjeta de prueba" })
      .click();
    await expect(page).toHaveURL((url) => url.hostname.endsWith("stripe.com"), {
      timeout: 30_000,
    });
  });

  test("cancel return does not claim a database state change", async ({
    page,
  }) => {
    await login(
      page,
      "/pagos/stripe/cancelado?pedido=78000000-0000-4000-8000-000000000002",
    );
    await expect(
      page.getByText(/no cancela el pedido, no cambia el pago/i),
    ).toBeVisible();
  });
});

async function login(page: import("@playwright/test").Page, path: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(path)}`);
  await page.getByLabel("Correo electrónico").fill("stripe.e2e@example.test");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === path.split("?")[0]);
}

function seedStripeCustomerOrders() {
  sql(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '18000000-0000-4000-8000-000000000001','authenticated','authenticated',
      'stripe.e2e@example.test',
      extensions.crypt('${password}', extensions.gen_salt('bf')),now(),
      '','','','',
      '{"provider":"email","providers":["email"]}',
      '{"first_name":"Stripe","last_name":"E2E"}',now(),now()
    );
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      '18000000-0000-4000-8000-000000000001',
      '18000000-0000-4000-8000-000000000001',
      '{"sub":"18000000-0000-4000-8000-000000000001","email":"stripe.e2e@example.test","email_verified":true}',
      'email',now(),now()
    );
    insert into public.orders (
      id, order_number, user_id, status, subtotal, total,
      shipping_address_snapshot, customer_name, customer_email,
      customer_phone, origin, confirmed_at
    ) values
      ('78000000-0000-4000-8000-000000000001','PG-W-STRIPE-E2E-1',
       '18000000-0000-4000-8000-000000000001','pending_confirmation',12500,12500,
       '{"recipient_name":"Stripe E2E","phone":"4420000000","street":"Prueba","exterior_number":"1","neighborhood":"Centro","city":"Querétaro","state":"Querétaro","postal_code":"76000"}',
       'Stripe E2E','stripe.e2e@example.test','4420000000','web',null),
      ('78000000-0000-4000-8000-000000000002','PG-W-STRIPE-E2E-2',
       '18000000-0000-4000-8000-000000000001','preparing',12500,12500,
       '{"recipient_name":"Stripe E2E","phone":"4420000000","street":"Prueba","exterior_number":"1","neighborhood":"Centro","city":"Querétaro","state":"Querétaro","postal_code":"76000"}',
       'Stripe E2E','stripe.e2e@example.test','4420000000','web',now());
    insert into public.order_payments (
      order_id, provider, method, status, expected_amount, currency
    ) values
      ('78000000-0000-4000-8000-000000000001','stripe','card','pending',12500,'MXN'),
      ('78000000-0000-4000-8000-000000000002','stripe','card','pending',12500,'MXN');
    update public.site_settings set value='{"mode":"test"}'
      where key in ('payments.mode','stripe.checkout.mode');
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
