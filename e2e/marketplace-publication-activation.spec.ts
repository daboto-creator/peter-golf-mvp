import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_PUBLICATION_E2E === "1";
const password = "PublicationE2E123!";
const buyerEmail = "publication-buyer@example.test";
const adminEmail = "publication-admin@example.test";
const listingSlug = "marketplace-73200000-0000-4000-8000-000000000001";

test.describe("Marketplace public publication and activation @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_PUBLICATION_E2E=1 and MARKETPLACE_ENABLED=true.",
  );

  test.beforeAll(async () => {
    execFileSync("npm", ["run", "supabase:reset"], { stdio: "ignore" });
    preparePublicationScenario();
    await uploadApprovedImages();
  });

  test("eligible listing is integrated into catalog and safe product detail", async ({
    page,
  }) => {
    const response = await page.goto("/productos");
    expect(response?.status()).toBe(200);
    const publicPayload = await response?.text();
    await expect(page.getByText("Driver sintético PR10")).toBeVisible();
    await expect(
      page.getByText("Best Round Partner verificado").first(),
    ).toBeVisible();

    await page.goto(`/productos/${listingSlug}`);
    await expect(
      page.getByRole("heading", { name: "Driver sintético PR10" }),
    ).toBeVisible();
    await expect(page.getByText("Venta mediada por Best Round")).toBeVisible();
    await expect(page.getByText("Marca cosmética en la suela")).toBeVisible();
    const imageResponse = await page.request.get(
      (await page
        .locator('img[alt="Vista aprobada del driver"]')
        .first()
        .getAttribute("src")) ?? "",
    );
    expect(imageResponse.status()).toBe(200);

    expect(publicPayload).not.toMatch(
      /publication-partner@example[.]test|73100000-0000-4000-8000-000000000001|partner_net|commission_rate|comparables|bank/i,
    );
    const html = await page.content();
    expect(html).not.toMatch(
      /publication-partner@example[.]test|73100000-0000-4000-8000-000000000001|partner_net|commission_rate|comparables|bank/i,
    );
  });

  test("catalog and detail have no responsive overflow", async ({ page }) => {
    for (const path of ["/productos", `/productos/${listingSlug}`]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });

  test("Golfer adds server-priced item and confirms a changed price", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating cart path runs once on Desktop.");
    await login(page, buyerEmail, `/productos/${listingSlug}`);
    await page.getByRole("button", { name: "Agregar a Mi Bolsa" }).click();
    await expect(page.getByText("Artículo agregado")).toBeVisible();
    await page.goto("/carrito");
    await expect(page.getByText("Driver sintético PR10")).toBeVisible();
    await expect(
      page.getByText("Best Round Partner verificado", { exact: true }),
    ).toBeVisible();

    sql(`
      select set_config('peter_golf.cart_rpc_write','enabled',false);
      update public.cart_items set price_seen=124000
        where marketplace_listing_id='73200000-0000-4000-8000-000000000001';
      select set_config('peter_golf.cart_rpc_write','disabled',false);
    `);
    await page.reload();
    await expect(
      page.getByText("El precio de este artículo cambió."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Aceptar precio vigente" }).click();
    await expect(page.getByText("Cantidad actualizada")).toBeVisible();
    await expect(
      page.getByText("El precio de este artículo cambió."),
    ).toHaveCount(0);
  });

  test("Operations sees audited readiness and OFF blocks only new commerce", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The activation mutation runs once on Desktop.");
    await login(page, adminEmail, "/operacion/marketplace/configuracion");
    await expect(page.getByText("ON", { exact: true })).toBeVisible();
    await expect(page.getByText("READY", { exact: true })).toBeVisible();
    await page
      .getByLabel("Razón operativa")
      .fill("Validación E2E de apagado controlado");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Disable Marketplace" }).click();
    await expect(page.getByText(/Marketplace quedó desactivado/)).toBeVisible();
    expect(
      sqlValue(
        "select count(*) from public.audit_logs where action='marketplace.disabled' and actor_id='73000000-0000-4000-8000-000000000004'",
      ),
    ).not.toBe("0");

    await page.goto("/productos");
    await expect(page.getByText("Driver sintético PR10")).toHaveCount(0);
    await login(page, buyerEmail, "/carrito");
    await expect(
      page.getByText(/Marketplace no está disponible/),
    ).toBeVisible();
  });
});

async function login(page: Page, email: string, next: string) {
  await page.goto(`/iniciar-sesion?next=${encodeURIComponent(next)}`);
  if (new URL(page.url()).pathname !== "/iniciar-sesion") return;
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

function preparePublicationScenario() {
  const source = readFileSync(
    "supabase/tests/marketplace_publication_golfer_activation.sql",
    "utf8",
  );
  const fixture = source.slice(0, source.indexOf("-- Every mutable"));
  psql(`${fixture}\n${authFixture()}\ncommit;`);
}

function authFixture() {
  return `
    update auth.users set instance_id='00000000-0000-0000-0000-000000000000',
      encrypted_password=extensions.crypt('${password}',extensions.gen_salt('bf')),
      email_confirmed_at=now(),raw_app_meta_data='{"provider":"email","providers":["email"]}'::jsonb,
      confirmation_token='',recovery_token='',email_change_token_new='',email_change='',
      aud='authenticated',role='authenticated',updated_at=now()
      where id in('73000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000004');
    insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at)
      select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
      from auth.users where id in('73000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000004')
      on conflict(provider_id,provider) do nothing;
  `;
}

async function uploadApprovedImages() {
  const env = localEnvironment();
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const paths = JSON.parse(
    sqlValue(
      "select json_agg(storage_path order by storage_path) from public.marketplace_listing_images where listing_id='73200000-0000-4000-8000-000000000001'",
    ),
  ) as string[];
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  for (const path of paths) {
    const { error } = await client.storage
      .from("marketplace-listing-images")
      .upload(path, image, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
  }
}

function localEnvironment() {
  const environment = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  ) as Record<string, string>;
  if (!environment.SUPABASE_SERVICE_ROLE_KEY) {
    const localStatus = execFileSync(
      "npx",
      ["--no-install", "supabase", "status", "-o", "env"],
      { encoding: "utf8" },
    );
    environment.SUPABASE_SERVICE_ROLE_KEY =
      localStatus.match(/^SERVICE_ROLE_KEY="?([^"\n]+)"?$/m)?.[1] ?? "";
  }
  return environment;
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
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { encoding: "utf8" },
  ).trim();
}
