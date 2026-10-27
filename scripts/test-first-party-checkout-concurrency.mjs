import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

const databaseContainer = "supabase_db_peter-golf-mvp";

function runPsql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        databaseContainer,
        "psql",
        "-X",
        "-A",
        "-t",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        "postgres",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
    child.stdin.end(sql);
  });
}

function requireSuccess(result, operation) {
  if (result.code !== 0) {
    throw new Error(`${operation} failed: ${result.stderr || result.stdout}`);
  }
}

const ids = {
  buyerA: randomUUID(),
  buyerB: randomUUID(),
  brand: randomUUID(),
  category: randomUUID(),
  product: randomUUID(),
  variant: randomUUID(),
  inventory: randomUUID(),
  cartKeyA: randomUUID(),
  cartKeyB: randomUUID(),
  checkoutKeyA: randomUUID(),
  checkoutKeyB: randomUUID(),
};
const slug = `checkout-concurrency-${ids.product.slice(0, 8)}`;
const emailA = `checkout-${ids.buyerA}@example.test`;
const emailB = `checkout-${ids.buyerB}@example.test`;
let fixturesCreated = false;

async function cleanup() {
  const cleanupSql = `
begin;
alter table public.notification_deliveries disable trigger user;
alter table public.notification_events disable trigger user;
alter table public.payment_status_history disable trigger user;
alter table public.order_status_history disable trigger user;
alter table public.inventory_movements disable trigger user;
alter table public.inventory_reservations disable trigger user;
alter table public.orders disable trigger user;
alter table public.order_items disable trigger user;
alter table public.order_payments disable trigger user;
alter table public.carts disable trigger user;
alter table public.cart_items disable trigger user;
delete from public.notification_deliveries where notification_event_id in (
  select id from public.notification_events where order_id in (
    select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
  )
);
delete from public.notification_events where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.payment_status_history where payment_id in (
  select id from public.order_payments where order_id in (
    select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
  )
);
delete from public.payment_idempotency_keys where payment_id in (
  select id from public.order_payments where order_id in (
    select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
  )
);
delete from public.order_status_history where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.inventory_movements where inventory_id = '${ids.inventory}';
delete from public.inventory_reservations where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.order_idempotency_keys where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.order_payments where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.order_items where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.order_fulfillments where order_id in (
  select id from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}');
delete from public.cart_idempotency_keys where actor_id in ('${ids.buyerA}', '${ids.buyerB}');
delete from public.cart_items where cart_id in (
  select id from public.carts where user_id in ('${ids.buyerA}', '${ids.buyerB}')
);
delete from public.carts where user_id in ('${ids.buyerA}', '${ids.buyerB}');
delete from public.inventory where id = '${ids.inventory}';
delete from public.product_variants where id = '${ids.variant}';
delete from public.products where id = '${ids.product}';
delete from public.categories where id = '${ids.category}';
delete from public.brands where id = '${ids.brand}';
delete from auth.users where id in ('${ids.buyerA}', '${ids.buyerB}');
alter table public.notification_deliveries enable trigger user;
alter table public.notification_events enable trigger user;
alter table public.payment_status_history enable trigger user;
alter table public.order_status_history enable trigger user;
alter table public.inventory_movements enable trigger user;
alter table public.inventory_reservations enable trigger user;
alter table public.orders enable trigger user;
alter table public.order_items enable trigger user;
alter table public.order_payments enable trigger user;
alter table public.carts enable trigger user;
alter table public.cart_items enable trigger user;
commit;
`;
  const result = await runPsql(cleanupSql);
  requireSuccess(result, "Fixture cleanup");
}

try {
  const setup = await runPsql(`
begin;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('${ids.buyerA}', 'authenticated', 'authenticated', '${emailA}', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('${ids.buyerB}', 'authenticated', 'authenticated', '${emailB}', '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.brands (id, slug, name) values ('${ids.brand}', '${slug}', '${slug}');
insert into public.categories (id, slug, name) values ('${ids.category}', '${slug}', '${slug}');
insert into public.products (
  id, slug, sku, name, condition, brand_id, category_id, status,
  fulfillment_type, price, published
) values (
  '${ids.product}', '${slug}', '${slug}', 'Checkout Concurrency Fixture',
  'new', '${ids.brand}', '${ids.category}', 'active', 'in_stock', 10000, true
);
insert into public.product_variants (id, product_id, sku, name)
values ('${ids.variant}', '${ids.product}', '${slug}', 'Fixture Variant');
insert into public.inventory (id, variant_id, quantity_on_hand, quantity_reserved)
values ('${ids.inventory}', '${ids.variant}', 1, 0);
commit;
`);
  requireSuccess(setup, "Fixture setup");
  fixturesCreated = true;

  const shippingResult = await runPsql(
    "select id from public.shipping_methods where code='envio_nacional_temporal' and active",
  );
  requireSuccess(shippingResult, "Shipping method lookup");
  const shippingMethodId = shippingResult.stdout.split(/\s+/).at(-1);
  if (!shippingMethodId) throw new Error("Active MVP shipping method not found");

  const carts = await Promise.all(
    [
      [ids.buyerA, ids.cartKeyA],
      [ids.buyerB, ids.cartKeyB],
    ].map(async ([buyerId, cartKey]) => {
      const cart = await runPsql(`
set role authenticated;
select set_config('request.jwt.claim.sub', '${buyerId}', false);
select cart_id::text || '|' || version::text from public.add_customer_cart_item(
  '${ids.product}', '${ids.variant}', 1, '${cartKey}'
);
`);
      requireSuccess(cart, "Cart setup");
      const match = cart.stdout.match(/([0-9a-f-]{36})\|(\d+)/i);
      if (!match) throw new Error(`Could not read test cart id/version: ${cart.stdout}`);
      return { buyerId, id: match[1], version: Number(match[2]) };
    }),
  );

  // Hold the inventory row while both authenticated checkout sessions start.
  // They then contend for the same last unit after the lock is released.
  const blocker = spawn(
    "docker",
    ["exec", "-i", databaseContainer, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let blockerError = "";
  blocker.stderr.setEncoding("utf8").on("data", (chunk) => (blockerError += chunk));
  const blockerDone = new Promise((resolve, reject) =>
    blocker.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(blockerError || `Lock holder exited ${code}`)),
    ),
  );
  blocker.stdin.end(
    `begin; select id from public.inventory where id='${ids.inventory}' for update; select pg_sleep(1.5); commit;`,
  );
  await new Promise((resolve) => setTimeout(resolve, 200));

  const address = `'{"recipient_name":"Concurrency Buyer","phone":"5512345678","street":"Reforma","exterior_number":"10","neighborhood":"Centro","city":"CDMX","state":"CDMX","postal_code":"01000","country_code":"MX"}'::jsonb`;
  const attempts = await Promise.all(
    carts.map((cart, index) =>
      runPsql(`
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '${cart.buyerId}', true);
select order_id from public.create_customer_checkout_order(
  '${cart.id}', ${cart.version}, '${shippingMethodId}', null, ${address}, false,
  '${index === 0 ? ids.checkoutKeyA : ids.checkoutKeyB}', 'bank_transfer'
);
commit;
`),
    ),
  );
  await blockerDone;

  const succeeded = attempts.filter((attempt) => attempt.code === 0);
  const outOfStock = attempts.filter(
    (attempt) => attempt.code !== 0 && /Insufficient inventory/.test(attempt.stderr),
  );
  if (succeeded.length !== 1 || outOfStock.length !== 1) {
    throw new Error(`Expected one checkout and one out-of-stock result: ${JSON.stringify(attempts)}`);
  }

  const result = await runPsql(`
select
  (select quantity_on_hand || '|' || quantity_reserved from public.inventory where id='${ids.inventory}')
  || '|' || (select count(*) from public.orders where user_id in ('${ids.buyerA}', '${ids.buyerB}'))
  || '|' || (select count(*) from public.order_payments p join public.orders o on o.id=p.order_id where o.user_id in ('${ids.buyerA}', '${ids.buyerB}'))
  || '|' || (select count(*) from public.inventory_reservations r join public.orders o on o.id=r.order_id where o.user_id in ('${ids.buyerA}', '${ids.buyerB}') and r.status='ACTIVE');
`);
  requireSuccess(result, "Concurrency result lookup");
  if (result.stdout !== "1|1|1|1|1") {
    throw new Error(`Last-unit invariant failed (on_hand|reserved|orders|payments|active_reservations): ${result.stdout}`);
  }
  console.log("PASS: concurrent First Party checkout produced one payable order and one ACTIVE reservation for the last unit.");
} finally {
  if (fixturesCreated) await cleanup();
}
