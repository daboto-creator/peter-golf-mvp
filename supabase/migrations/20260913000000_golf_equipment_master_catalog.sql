-- Shared golf-equipment master data and authenticated reference reads.
-- This migration is additive: historical products and free-text identities remain valid.

drop policy if exists "authenticated users can read active golf reference categories" on public.categories;
create policy "authenticated users can read active golf reference categories"
on public.categories for select to authenticated
using (status = 'active');

drop policy if exists "authenticated users can read active golf reference category profiles" on public.category_spec_profiles;
create policy "authenticated users can read active golf reference category profiles"
on public.category_spec_profiles for select to authenticated
using (true);

alter table public.brands add column if not exists official_domain text;
alter table public.brands add column if not exists verified boolean not null default false;
alter table public.brands add column if not exists reference_source text;
alter table public.brands add column if not exists last_verified_at timestamptz;

alter table public.catalog_product_models add column if not exists lifecycle_status text not null default 'CURRENT';
alter table public.catalog_product_models add column if not exists reference_priority smallint not null default 2;
alter table public.catalog_product_models add column if not exists reference_status text not null default 'VERIFIED';
alter table public.catalog_product_models add column if not exists reference_source text;
alter table public.catalog_product_models add column if not exists reference_url text;
alter table public.catalog_product_models add column if not exists last_verified_at timestamptz;
alter table public.catalog_product_models drop constraint if exists catalog_product_models_lifecycle_status_check;
alter table public.catalog_product_models add constraint catalog_product_models_lifecycle_status_check check (lifecycle_status in ('CURRENT','RECENT','HISTORIC'));
alter table public.catalog_product_models drop constraint if exists catalog_product_models_reference_status_check;
alter table public.catalog_product_models add constraint catalog_product_models_reference_status_check check (reference_status in ('VERIFIED','NEEDS_REVIEW'));
alter table public.catalog_product_models drop constraint if exists catalog_product_models_reference_priority_check;
alter table public.catalog_product_models add constraint catalog_product_models_reference_priority_check check (reference_priority between 1 and 3);

-- Initial, source-controlled brand registry. Models are seeded only where the
-- canonical catalog already has the corresponding category taxonomy.
with seed(name, slug, domain) as (values
  ('TaylorMade','taylormade','taylormadegolf.com'),('Callaway','callaway','callawaygolf.com'),
  ('Titleist','titleist','titleist.com'),('PING','ping','ping.com'),('Cobra','cobra','cobragolf.com'),
  ('Mizuno','mizuno','mizunogolf.com'),('Srixon','srixon','srixon.com'),('Cleveland Golf','cleveland-golf','clevelandgolf.com'),
  ('PXG','pxg','pxg.com'),('Wilson Staff','wilson-staff','wilson.com'),('Odyssey','odyssey','odysseygolf.com'),
  ('Scotty Cameron','scotty-cameron','scottycameron.com'),('Vokey','vokey','vokey.com'),('Honma','honma','honmagolf.com'),
  ('XXIO','xxio','xxio.com'),('Bridgestone Golf','bridgestone-golf','bridgestonegolf.com'),('Tour Edge','tour-edge','touredge.com'),
  ('Miura','miura','miuragolf.com'),('PRGR','prgr','prgr-golf.com'),('Yonex','yonex','yonex.com'),
  ('Fourteen Golf','fourteen-golf','fourteengolf.com'),('Epon','epon','epongolf.com'),('Proto Concept','proto-concept','protoconcept.com'),
  ('MacGregor Golf','macgregor-golf','macgregorgolf.com'),('Ben Hogan Golf','ben-hogan-golf','benhogangolf.com'),('Adams Golf','adams-golf','adamsgolf.com'),
  ('Takomo Golf','takomo-golf','takomogolf.com'),('Sub 70','sub-70','sub70golf.com'),('Haywood Golf','haywood-golf','haywoodgolf.com'),('LA Golf','la-golf','lagolf.com')
)
insert into public.brands (name, slug, official_domain, verified, reference_source, last_verified_at)
select name, slug, domain, true, 'OFFICIAL_MANUFACTURER', now() from seed
on conflict (slug) do update set official_domain=excluded.official_domain, verified=true,
  reference_source='OFFICIAL_MANUFACTURER', last_verified_at=now(), status='active';

with seed(brand, category, model, normalized, priority, lifecycle, url) as (values
 ('TaylorMade','driver','Qi10','qi10',1,'CURRENT','https://www.taylormadegolf.com/'),('TaylorMade','driver','Stealth 2','stealth-2',2,'RECENT','https://www.taylormadegolf.com/'),
 ('Callaway','driver','Paradym Ai Smoke','paradym-ai-smoke',1,'CURRENT','https://www.callawaygolf.com/'),('Callaway','driver','Paradym','paradym',2,'RECENT','https://www.callawaygolf.com/'),
 ('Titleist','driver','GT3','gt3',1,'CURRENT','https://www.titleist.com/'),('Titleist','driver','TSR2','tsr2',2,'RECENT','https://www.titleist.com/'),
 ('PING','driver','G440','g440',1,'CURRENT','https://ping.com/'),('PING','driver','G430','g430',2,'RECENT','https://ping.com/'),
 ('Cobra','driver','DS-ADAPT','ds-adapt',1,'CURRENT','https://www.cobragolf.com/'),('Cobra','driver','DARKSPEED','darkspeed',2,'RECENT','https://www.cobragolf.com/'),
 ('Mizuno','driver','ST-MAX 230','st-max-230',1,'CURRENT','https://mizunogolf.com/'),('Mizuno','iron','JPX 925','jpx-925',1,'CURRENT','https://mizunogolf.com/'),
 ('Srixon','driver','ZXi','zxi',1,'CURRENT','https://www.srixon.com/'),('Srixon','iron','ZX Mk II','zx-mk-ii',2,'RECENT','https://www.srixon.com/'),
 ('Cleveland Golf','wedge','RTX 6 ZipCore','rtx-6-zipcore',1,'CURRENT','https://www.clevelandgolf.com/'),('Cleveland Golf','wedge','CBX 4 ZipCore','cbx-4-zipcore',1,'CURRENT','https://www.clevelandgolf.com/'),
 ('PXG','driver','0311 Black Ops','0311-black-ops',1,'CURRENT','https://www.pxg.com/'),('PXG','iron','0311 P GEN7','0311-p-gen7',1,'CURRENT','https://www.pxg.com/'),
 ('Wilson Staff','driver','Dynapower','dynapower',2,'RECENT','https://www.wilson.com/'),('Wilson Staff','iron','DynaPower','dynapower',2,'RECENT','https://www.wilson.com/'),
 ('Odyssey','putter','Ai-ONE','ai-one',1,'CURRENT','https://www.odysseygolf.com/'),('Odyssey','putter','White Hot OG','white-hot-og',2,'RECENT','https://www.odysseygolf.com/'),
 ('Scotty Cameron','putter','Phantom','phantom',1,'CURRENT','https://www.scottycameron.com/'),('Scotty Cameron','putter','Super Select Newport','super-select-newport',2,'RECENT','https://www.scottycameron.com/'),
 ('Vokey','wedge','SM10','sm10',1,'CURRENT','https://www.vokey.com/'),('Vokey','wedge','SM9','sm9',2,'RECENT','https://www.vokey.com/'),
 ('Honma','driver','TW757','tw757',2,'RECENT','https://www.honmagolf.com/'),('Honma','iron','TW767','tw767',1,'CURRENT','https://www.honmagolf.com/'),
 ('XXIO','driver','13','13',1,'CURRENT','https://www.xxio.com/'),('XXIO','iron','Prime','prime',2,'RECENT','https://www.xxio.com/'),
 ('Bridgestone Golf','driver','B3 MAX','b3-max',1,'CURRENT','https://www.bridgestonegolf.com/'),('Bridgestone Golf','iron','242CB+','242cb-plus',1,'CURRENT','https://www.bridgestonegolf.com/'),
 ('Tour Edge','driver','Exotics C725','exotics-c725',1,'CURRENT','https://www.touredge.com/'),('Tour Edge','fairway-wood','Exotics C725','exotics-c725',1,'CURRENT','https://www.touredge.com/'),
 ('Miura','iron','CB-302','cb-302',2,'RECENT','https://miuragolf.com/'),('PRGR','driver','RS X','rs-x',1,'CURRENT','https://www.prgr-golf.com/'),
 ('Yonex','iron','EZONE GT','ezone-gt',2,'RECENT','https://www.yonex.com/'),('Fourteen Golf','wedge','RM Wedge','rm-wedge',2,'RECENT','https://www.fourteengolf.com/'),
 ('Epon','iron','AF-507','af-507',2,'RECENT','https://epongolf.com/'),('Proto Concept','iron','C07','c07',2,'CURRENT','https://protoconcept.com/'),
 ('MacGregor Golf','iron','MACTEC','mactec',3,'HISTORIC','https://www.macgregorgolf.com/'),('Ben Hogan Golf','iron','PTX Tour','ptx-tour',3,'HISTORIC','https://benhogangolf.com/'),
 ('Adams Golf','hybrid','Idea','idea',3,'HISTORIC','https://www.adamsgolf.com/'),('Takomo Golf','iron','101','101',1,'CURRENT','https://takomogolf.com/'),
 ('Sub 70','driver','849D','849d',1,'CURRENT','https://sub70golf.com/'),('Haywood Golf','driver','Eagle','eagle',1,'CURRENT','https://haywoodgolf.com/'),
 ('LA Golf','putter','Malibu','malibu',1,'CURRENT','https://lagolf.com/')
)
insert into public.catalog_product_models (brand_id, category_id, model_name, normalized_model_name, lifecycle_status, reference_priority, reference_status, reference_source, reference_url, last_verified_at)
select b.id, c.id, s.model, s.normalized, s.lifecycle, s.priority, 'VERIFIED', 'OFFICIAL_MANUFACTURER', s.url, now()
from seed s join public.brands b on b.slug = lower(replace(s.brand,' ', '-'))
join public.categories c on c.slug = s.category
on conflict (brand_id, category_id, normalized_model_name) do update set
  lifecycle_status=excluded.lifecycle_status, reference_priority=excluded.reference_priority,
  reference_status='VERIFIED', reference_source=excluded.reference_source,
  reference_url=excluded.reference_url, last_verified_at=excluded.last_verified_at, status='active';
