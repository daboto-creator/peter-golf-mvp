# Marketplace Foundation

## Alcance de PR 1

Esta base agrega el modo potencial `Best Round Partner` a una cuenta existente
sin crear otra identidad, sesión ni rol administrativo:

```text
auth.users -> profiles -> partner_profiles (0..1)
```

`partner_profiles.status` determina el estado comercial. Ser Partner no agrega
una fila `partner` a `user_roles`; `operator` y `admin` permanecen como
capacidades internas separadas.

Marketplace queda cerrado por dos controles server-side:

- `MARKETPLACE_ENABLED=false` por defecto en Next.js;
- `site_settings['marketplace.enabled'] = {"enabled": false}` en PostgreSQL.

PR 2 agrega rutas autenticadas de onboarding y revisión, pero habilitar una
variable no publica ningún listing: los módulos de listings y venta se
implementarán en PRs posteriores y deberán exigir ambos controles.

## Estados Partner

Los estados iniciales son `REGISTERED`, `IDENTITY_PENDING`, `UNDER_REVIEW`,
`VERIFIED`, `SUSPENDED` y `REJECTED`. `transition_partner_status`:

- autoriza únicamente a `operator` o `admin`;
- exige motivo;
- valida la transición;
- usa `version` como control de concurrencia optimista;
- conserva cada cambio en `partner_status_history` y `audit_logs`;
- no elimina perfil, documentos ni historia al suspender o rechazar.

El alta idempotente usa `register_partner_profile`. Mientras el kill switch de
base de datos está apagado, el alta falla cerrada.

## Configuración versionada

`marketplace_config_versions` agrupa snapshots. Sólo puede existir una versión
`PUBLISHED` abierta. `publish_marketplace_config_version` serializa publicaciones
con advisory lock, retira la versión anterior y registra actor, razón y valores
de publicación en `audit_logs`.

La versión inicial contiene exclusivamente los baselines aprobados:

| Tier        | Comisión |
| ----------- | -------: |
| BOGEY       | 1500 bps |
| PAR         | 1400 bps |
| BIRDIE      | 1300 bps |
| ALBATROSS   | 1200 bps |
| HOLE_IN_ONE | 1100 bps |

- processing a cargo del Partner: `5000 bps`;
- cargo administrativo: `75 bps + 3900` centavos;
- ventana de promedio móvil: `30` días elegibles.

Los umbrales de volumen/score, pesos, prior neutral, smoothing, muestra mínima y
normalización permanecen `NULL` o sin filas. PR 4 deberá aprobarlos y publicarlos
como una nueva versión; no se infieren en esta foundation. Los días anteriores a
la verificación no serán ceros: el futuro cálculo usará los días elegibles dentro
de la ventana configurada y el historial de estado para reconstruirlos.

## KYC y Storage

`partner_documents` almacena sólo metadata operativa: tipo genérico, ruta UUID,
MIME, tamaño, hash y revisión. No define requisitos legales, no almacena datos
bancarios, números de tarjeta ni contenido del documento.

El bucket `partner-kyc` es privado. Las rutas siguen:

```text
partners/{partner_profile_uuid}/{random_document_uuid}.{extension}
```

RLS permite al Partner leer/subir/eliminar sólo sus archivos; no puede eliminar
un archivo ya revisado. Operations puede leer para revisión. No existen URLs
públicas ni acceso anónimo.

## RLS y capacidades

- Partner: perfil, historial y documentos propios.
- Golfer sin perfil Partner: ningún dato Partner privado.
- Operations: perfiles, historial, metadata/documentos y auditoría Marketplace.
- Admin: lo anterior y configuración financiera/versionada.
- Ningún cliente recibe escritura directa sobre estado, auditoría o config.
- Las funciones `security definer` fijan `search_path = ''` y revalidan capacidad.
- No se usa `service_role` en el cliente.

Los logs contienen estado, versión y razones operativas; nunca contenido KYC.

## Límites deliberados de bounded context

No se crean en PR 1 productos, modelos canónicos, listings ni inventario
Marketplace. Cuando se implementen:

- `catalog_product_models` será identidad canónica y referenciará `brands`,
  `categories`, `category_spec_profiles`, `product_club_specs`,
  `product_bag_specs`, `product_set_composition`, `product_accessory_specs` y la
  taxonomía vigente; no duplicará especificaciones;
- inventory/reservations soportarán `quantity = 1` y `quantity > 1`;
- ownership Marketplace será solamente `PARTNER_OWNED`;
- custody será `PARTNER_CUSTODY` o `BEST_ROUND_CUSTODY`;
- inventario propiedad de Best Round seguirá en el bounded context first-party.

PR 2 implementa onboarding UI y Portal Partner shell. PR 3 implementa listings
privados versionados y aprobación humana. Siguen fuera de alcance el score/tier
engine, Marketplace pricing, checkout multi-Partner,
fulfillment, shipping, ledger, payouts y disputas.

## Ejecución de pruebas SQL

Después de reiniciar Supabase local:

```bash
npm run supabase:reset
docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < supabase/tests/marketplace_foundation.sql
```

La prueba abre una transacción y termina con `ROLLBACK`. Cubre flag apagado,
registro, aislamiento Partner A/B, Golfer, capacidades Operations/Admin, KYC
privado, transiciones/version conflict, auditoría inmutable y publicación de
configuración.
