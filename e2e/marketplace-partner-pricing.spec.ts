import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.RUN_MARKETPLACE_PRICING_E2E === "1";
const password = "PricingE2E123!";
const partnerEmail = "e2e.marketplace.pricing@example.test";
const operatorEmail = "e2e.marketplace.pricing-operator@example.test";
const listingId = "45000000-0000-4000-8000-000000000101";

test.describe("Marketplace Partner Pricing @mutating", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(
    !enabled,
    "Set RUN_MARKETPLACE_PRICING_E2E=1 and MARKETPLACE_ENABLED=true.",
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
    preparePricingScenario();
  });

  test("Partner saves deterministic economics inside the single submission flow", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "The mutating approval path runs once on Desktop.");
    await login(
      page,
      partnerEmail,
      `/partner/publicaciones/${listingId}/precio`,
    );
    await expect(
      page.getByRole("heading", { name: "Define tu precio" }),
    ).toBeVisible();
    await page.getByLabel("Tu precio de venta (MXN)").fill("10000");
    await page
      .getByRole("button", { name: "Calcular y guardar precio" })
      .click();
    await expect(page.getByText("Tu resultado")).toBeVisible();
    await expect(page.getByText("Comisión Best Round")).toBeVisible();
    await expect(page.getByText("IVA de comisión")).toBeVisible();
    await expect(page.getByText("Fee procesamiento")).toBeVisible();
    await expect(page.getByText("Recibirías aproximadamente")).toBeVisible();
    await expect(page.getByText("parte del Partner")).toHaveCount(0);
    await expect(page.getByText("parte Best Round")).toHaveCount(0);
    expect(
      sqlValue(
        `select effective_partner_tier||'|'||tier_source||'|'||commission_rate_bps||'|'||coalesce(effective_tier_override_id::text,'') from public.marketplace_pricing_quotes where listing_id='${listingId}' order by created_at desc limit 1`,
      ),
    ).toBe("ALBATROSS|OVERRIDE|1200|45000000-0000-4000-8000-000000000021");
    expect(
      sqlValue(
        `select status from public.marketplace_pricing_quotes where listing_id='${listingId}' order by created_at desc limit 1`,
      ),
    ).toBe("DRAFT");
  });

  test("Pricing breakdown has no horizontal overflow on phones", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "Responsive pricing coverage.");
    await login(
      page,
      partnerEmail,
      `/partner/publicaciones/${listingId}/precio`,
    );
    await expect(page.getByText("Best Round Intelligence")).toBeVisible();
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
  const emailInput = page.getByLabel("Correo electrónico");
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL((url) => url.pathname === next);
}

function preparePricingScenario() {
  sql(`
    update public.site_settings set value='{"enabled":true}' where key='marketplace.enabled';
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_token,recovery_token,email_change_token_new,email_change,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
      ('00000000-0000-0000-0000-000000000000','45000000-0000-4000-8000-000000000001','authenticated','authenticated','${partnerEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now()),
      ('00000000-0000-0000-0000-000000000000','45000000-0000-4000-8000-000000000002','authenticated','authenticated','${operatorEmail}',extensions.crypt('${password}',extensions.gen_salt('bf')),now(),'','','','','{"provider":"email","providers":["email"]}','{}',now(),now());
    insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at)
      select id::text,id,jsonb_build_object('sub',id::text,'email',email,'email_verified',true),'email',now(),now()
      from auth.users where id::text like '45000000-0000-4000-8000-00000000000%';
    insert into public.user_roles (user_id,role_id) select '45000000-0000-4000-8000-000000000002',id from public.roles where name='operator';
    insert into public.partner_profiles (id,user_id,legal_type,status,verified_at) values ('45000000-0000-4000-8000-000000000011','45000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now());
    insert into public.partner_score_tier_state (partner_id,current_tier,highest_eligible_tier,current_config_version_id)
      values ('45000000-0000-4000-8000-000000000011','BIRDIE','BIRDIE',(select id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null));
    insert into public.partner_score_tier_overrides (id,partner_id,override_type,tier,status,reason,starts_at,expires_at,created_by)
      values ('45000000-0000-4000-8000-000000000021','45000000-0000-4000-8000-000000000011','TIER','ALBATROSS','ACTIVE','Authorized E2E tier override',now()-interval '1 hour',now()+interval '1 day','45000000-0000-4000-8000-000000000002');
    do $$ declare brand_id uuid; category_id uuid; model_id uuid:=gen_random_uuid(); version_id uuid:=gen_random_uuid(); begin
      select id into brand_id from public.brands order by name limit 1;
      select id into category_id from public.categories where slug='driver';
      insert into public.catalog_product_models (id,brand_id,category_id,model_name,normalized_model_name) values (model_id,brand_id,category_id,'E2E GT3','e2e-gt3');
      insert into public.marketplace_listings (id,partner_id,status) values ('${listingId}','45000000-0000-4000-8000-000000000011','DRAFT');
      insert into public.marketplace_listing_versions (id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,title,condition,condition_grade,condition_notes,defects_acknowledged,specifications,quantity,created_by)
        values (version_id,'${listingId}',1,'DRAFT',model_id,brand_id,category_id,'Titleist GT3 Driver 9 Regular','used','excellent','Approved E2E condition',true,'{"loft_degrees":9}',1,'45000000-0000-4000-8000-000000000001');
      update public.marketplace_listings set current_version_id=version_id where id='${listingId}';
      insert into public.marketplace_listing_inventory (listing_id,quantity_on_hand) values ('${listingId}',1);
    end $$;
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
