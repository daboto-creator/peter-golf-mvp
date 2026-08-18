import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

const email = "golf-taxonomy.e2e@example.test";
const password = "GolfTaxonomy123!";

test.describe("golf product create, edit and reload @mutating", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "Desktop Chrome",
      "The mutation cycle runs once on desktop; responsive forms are covered separately.",
    );
  });

  test.beforeAll(() => prepareOperator());

  test("persists Driver, Wedge, Putter, Stand Bag and Complete Set fields", async ({
    page,
  }) => {
    await login(page);

    await createEditReload(page, {
      slug: "e2e-final-driver",
      category: "Driver",
      values: {
        model: "GT3",
        modelYear: "2025",
        handedness: "right",
        shaftMaterial: "graphite",
        shaftBrand: "Mitsubishi",
        shaftModel: "Tensei 1K Blue",
        shaftFlex: "regular",
        shaftWeightGrams: "65",
        clubLengthInches: "45.5",
        gripBrand: "Golf Pride",
        gripModel: "Tour Velvet",
        gripCondition: "Excelente",
        headcoverIncluded: "yes",
        loftDegrees: "10.5",
        adjustableLoft: "yes",
        adjustableHosel: "yes",
        adjustmentToolIncluded: "yes",
      },
      edit: { loftDegrees: "9" },
    });
    await createEditReload(page, {
      slug: "e2e-final-wedge",
      category: "Wedge",
      values: {
        model: "SM10",
        modelYear: "2025",
        handedness: "right",
        shaftMaterial: "steel",
        shaftFlex: "stiff",
        loftDegrees: "56",
        bounceDegrees: "12",
        grind: "M",
        gripBrand: "Golf Pride",
      },
      edit: { bounceDegrees: "10" },
    });
    await createEditReload(page, {
      slug: "e2e-final-putter",
      category: "Putter",
      values: {
        model: "Phantom",
        modelYear: "2025",
        handedness: "right",
        shaftMaterial: "steel",
        putterHeadType: "mallet",
        lengthInches: "34",
        loftDegrees: "3",
        lieDegrees: "70",
        neckType: "Slant",
        headcoverIncluded: "yes",
      },
      edit: { lengthInches: "35" },
    });
    await createEditReload(page, {
      slug: "e2e-final-stand-bag",
      category: "Stand Bag",
      values: {
        model: "Carry Pro",
        modelYear: "2025",
        color: "Negro",
        dividerCount: "4",
        pocketCount: "7",
        weightKg: "2.2",
        rainHoodIncluded: "yes",
        strapIncluded: "yes",
        waterproof: "no",
        cartCompatible: "yes",
      },
      edit: { color: "Azul" },
    });
    await createEditReload(page, {
      slug: "e2e-final-complete-set",
      category: "Complete Set",
      values: {
        model: "Starter Pro",
        modelYear: "2025",
        handedness: "right",
        shaftMaterial: "graphite",
        shaftFlex: "regular",
      },
      edit: { model: "Starter Pro 2" },
      components: [
        { kind: "club", clubType: "driver", number: "1", loft: "10.5" },
        { kind: "club", clubType: "putter", number: "34 in" },
        { kind: "bag", bagType: "stand_bag" },
      ],
    });
  });
});

type Cycle = {
  slug: string;
  category: string;
  values: Record<string, string>;
  edit: Record<string, string>;
  components?: Array<{
    kind: "club" | "bag";
    clubType?: string;
    bagType?: string;
    number?: string;
    loft?: string;
  }>;
};

async function createEditReload(page: Page, cycle: Cycle) {
  await page.goto("/operacion/catalogo/nuevo");
  await page.locator("#name").fill(cycle.slug.replaceAll("-", " "));
  await page.locator("#slug").fill(cycle.slug);
  await page.locator("#sku").fill(cycle.slug.toUpperCase());
  await page.locator("#brandId").selectOption({ index: 1 });
  await selectCategory(page, cycle.category);
  await page.locator("#price").fill("1250.00");
  await fillValues(page, cycle.values);
  if (cycle.components) await fillComponents(page, cycle.components);
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(
    /\/operacion\/catalogo\/[0-9a-f-]+\/editar\?creado=1/,
  );
  await assertValues(page, cycle.values);

  await fillValues(page, cycle.edit);
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText("El producto se actualizó correctamente."),
  ).toBeVisible();
  await page.reload();
  await assertValues(page, { ...cycle.values, ...cycle.edit });
  if (cycle.components) {
    await expect(page.locator('[id^="components-"][id$="-kind"]')).toHaveCount(
      cycle.components.length,
    );
  }
}

async function fillValues(page: Page, values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) {
    const field = page.locator(`#${id}`);
    await expect(field).toBeVisible();
    if ((await field.evaluate((element) => element.tagName)) === "SELECT") {
      await field.selectOption(value);
    } else {
      await field.fill(value);
    }
  }
}

async function assertValues(page: Page, values: Record<string, string>) {
  for (const [id, value] of Object.entries(values)) {
    await expect(page.locator(`#${id}`)).toHaveValue(value);
  }
}

async function fillComponents(
  page: Page,
  components: NonNullable<Cycle["components"]>,
) {
  for (let index = 0; index < components.length; index += 1) {
    await page.getByRole("button", { name: "Agregar componente" }).click();
    const component = components[index];
    await page
      .locator(`#components-${index}-kind`)
      .selectOption(component.kind);
    if (component.clubType)
      await page
        .locator(`#components-${index}-club`)
        .selectOption(component.clubType);
    if (component.bagType)
      await page
        .locator(`#components-${index}-bag`)
        .selectOption(component.bagType);
    if (component.number)
      await page.locator(`#components-${index}-number`).fill(component.number);
    if (component.loft)
      await page.locator(`#components-${index}-loft`).fill(component.loft);
  }
}

async function selectCategory(page: Page, name: string) {
  const option = page.locator("#categoryId option", { hasText: name }).last();
  const value = await option.getAttribute("value");
  if (!value) throw new Error(`Category ${name} is unavailable`);
  await page.locator("#categoryId").selectOption(value);
  await expect(page.getByText("Especificaciones de golf")).toBeVisible();
}

async function login(page: Page) {
  await page.goto("/iniciar-sesion?next=/operacion/catalogo");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/operacion\/catalogo$/);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(250);
}

function prepareOperator() {
  sql(`
    delete from public.products where slug like 'e2e-final-%';
    delete from auth.users where email = '${email}';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '19500000-0000-4000-8000-000000000001','authenticated','authenticated',
      '${email}', extensions.crypt('${password}', extensions.gen_salt('bf')),now(),
      '','','','', '{"provider":"email","providers":["email"]}',
      '{"first_name":"Golf","last_name":"E2E"}',now(),now()
    );
    insert into public.user_roles (user_id, role_id)
    select '19500000-0000-4000-8000-000000000001', id
    from public.roles where name = 'operator';
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, created_at, updated_at
    ) values (
      '19500000-0000-4000-8000-000000000001',
      '19500000-0000-4000-8000-000000000001',
      '{"sub":"19500000-0000-4000-8000-000000000001","email":"${email}","email_verified":true}',
      'email',now(),now()
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
