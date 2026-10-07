-- Curated MVP selector universe. Historical rows remain intact and continue to
-- reference archived brands; only canonical selector visibility changes.
update public.brands
set status = 'archived'
where status = 'active'
  and slug in (
    'epon', 'fourteen-golf', 'haywood-golf', 'la-golf', 'macgregor-golf',
    'miura', 'prgr', 'proto-concept', 'takomo-golf', 'xxio', 'yonex'
  );
