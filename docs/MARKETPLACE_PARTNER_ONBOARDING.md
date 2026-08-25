# Marketplace Partner Onboarding

## Alcance de PR 2

PR 2 convierte la foundation privada de Marketplace en un flujo funcional,
todavía cerrado por los dos feature flags existentes:

```text
Golfer autenticado
  -> register_partner_profile
  -> onboarding progresivo
  -> partner-kyc privado
  -> submit_partner_for_review
  -> revisión humana Operations
  -> Portal Partner
```

No crea una segunda cuenta, sesión ni rol `partner`. El selector Modo Golfer /
Modo Partner guarda únicamente contexto UX en una cookie `httpOnly`; no concede
permisos. La autorización sigue dependiendo de sesión, RLS, Partner status y
capabilities Operations.

El siguiente bounded context está documentado en
`MARKETPLACE_PARTNER_LISTINGS.md`: sólo un Partner `VERIFIED` puede enviar un
listing versionado a revisión. Onboarding y estado Partner continúan siendo la
fuente de elegibilidad; no se duplican en listings.

## Datos y progresión

La migration `20260825000000_marketplace_partner_onboarding.sql` agrega columnas
privadas y opcionales a `partner_profiles`; no crea una tabla paralela. Las
escrituras pasan por RPCs con allowlist de campos y versión esperada:

- `save_partner_onboarding`: datos básicos, fiscales y avance;
- `register_partner_document`: registra metadata después del upload privado;
- `get_partner_onboarding_readiness`: criterios objetivos de avance;
- `submit_partner_for_review`: valida el mínimo técnico y envía a revisión;
- `review_partner_document`: revisión con capability y concurrencia optimista.

El mínimo técnico de PR 2 es información básica, información fiscal cuando
aplica y al menos un documento vigente. Esto no define una política legal por
tipo de Partner. `KYC retention policy = TBD_LEGAL_REVIEW`.

`REGISTERED` e `IDENTITY_PENDING` son editables. `UNDER_REVIEW`, `VERIFIED`,
`SUSPENDED` y `REJECTED` son de sólo lectura para el Partner. Solicitar cambios
usa un documento `REJECTED`, una razón y la transición existente a
`IDENTITY_PENDING`; no se agregó un estado paralelo `CHANGES_REQUESTED`.

## Seguridad documental

- bucket `partner-kyc` privado;
- rutas `partners/{partner_uuid}/{document_uuid}.{extension}`;
- MIME, extensión, firma y máximo de 10 MiB validados en servidor;
- hash SHA-256 guardado para integridad, nunca en auditoría;
- signed URLs de 60 segundos, generadas sólo tras validar
  `can_review_partner_documents`;
- Partner A, Partner B, Golfer y anonymous permanecen aislados por RLS/Storage.

El contenido KYC no se carga en listados ni se agrega a logs, URLs o telemetry.
Operations ve sólo metadata hasta solicitar expresamente abrir un documento.

## Rutas

- `/partner`: dashboard basado sólo en datos reales;
- `/partner/perfil`: perfil privado;
- `/partner/verificacion`: estado y documentos;
- `/partner/onboarding/*`: wizard progresivo;
- `/operacion/marketplace/partners`: cola paginada;
- `/operacion/marketplace/partners/[id]`: revisión, historial y transiciones.

Publicaciones, ventas, liquidaciones, score y tier aparecen únicamente como
áreas deshabilitadas “Próximamente”. VERIFIED no puede publicar todavía.

## Pruebas

```bash
npm run supabase:reset
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/marketplace_foundation.sql
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/marketplace_partner_onboarding.sql
RUN_MARKETPLACE_E2E=1 MARKETPLACE_ENABLED=true \
  npx --no-install playwright test \
  e2e/marketplace-partner-onboarding.spec.ts --project='Desktop Chrome'
```

El E2E es opt-in porque reinicia Supabase local. Marketplace continúa apagado
por defecto y el suite normal lo omite de forma intencional.
