# Peter Golf

Peter Golf será una tienda online de artículos de golf para México. La operación inicial estará en Querétaro y ofrecerá envíos a todo el país, con productos nuevos y seminuevos, tanto disponibles en stock como sobre pedido.

La propuesta de valor no se limita a vender productos: un equipo inicial de dos personas acompañará y asesorará al cliente durante su decisión de compra.

## Estado actual

El repositorio contiene el scaffold técnico inicial y la documentación base del MVP. La interfaz aún corresponde a la plantilla de Next.js.

Todavía no están implementados el catálogo, la autenticación, el carrito, el checkout, el panel administrativo, los pagos ni la conexión con Supabase. El MVP se validará primero sin pagos reales.

## Stack previsto

- Next.js 16 con App Router
- React 19
- TypeScript en modo estricto
- Tailwind CSS 4
- ESLint
- Supabase en una fase posterior para persistencia, autenticación y almacenamiento, sujeto al diseño final
- Plataforma de despliegue por decidir; Vercel es compatible con el scaffold actual, pero no está formalmente adoptado

No se ha seleccionado ni integrado un proveedor de pagos.

## Desarrollo

El flujo esperado es:

1. Crear una rama dedicada para cada tarea.
2. Inspeccionar el repositorio y leer la documentación instalada de Next.js aplicable.
3. Implementar sólo el alcance acordado.
4. Ejecutar lint, typecheck, pruebas y build.
5. Reportar cambios, validaciones, supuestos y riesgos.
6. Abrir revisión antes de integrar; nunca hacer push directo a `main`.

Las reglas completas están en [AGENTS.md](./AGENTS.md).

## Ambientes

Staging y producción tendrán recursos, secretos y datos separados.

| Ambiente | Uso | Supabase previsto |
| --- | --- | --- |
| Staging | Desarrollo, pruebas y validación del MVP sin pagos reales | Organización `daboto-creator's Org`, proyecto `peter-golf-staging` |
| Producción | Operación real futura | Organización `daboto-creator's Org`, proyecto `peter-golf-production` |

Estos proyectos son nombres planeados: esta etapa no crea ni configura Supabase. Staging nunca debe usar llaves live, secretos ni datos de producción.

## Comandos actuales

Requisitos: una versión de Node.js compatible con Next.js 16 y npm.

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
```

`npm run dev` inicia el servidor de desarrollo en [http://localhost:3000](http://localhost:3000). `npm run start` requiere haber ejecutado antes `npm run build`.

El proyecto todavía no define scripts `typecheck` ni `test`. Deben agregarse en una tarea posterior antes de considerarlos controles obligatorios automatizados; mientras tanto puede comprobarse TypeScript con `npx tsc --noEmit`.

## Documentación

- [Requisitos de producto](./docs/PRODUCT_REQUIREMENTS.md)
- [Reglas de negocio](./docs/BUSINESS_RULES.md)
- [Guía de marca](./docs/BRAND_GUIDE.md)
- [Modelo de datos](./docs/DATABASE_MODEL.md)
- [Requisitos de seguridad](./docs/SECURITY_REQUIREMENTS.md)
- [Criterios de aceptación](./docs/MVP_ACCEPTANCE_CRITERIA.md)
- [Plan de pruebas](./docs/TESTING_PLAN.md)
- [Runbook de despliegue](./docs/DEPLOYMENT_RUNBOOK.md)
