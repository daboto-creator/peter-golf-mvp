# Reglas de trabajo para Peter Golf

Estas instrucciones aplican a cualquier agente que trabaje en este repositorio.

## Antes de cambiar el repositorio

1. Trabajar en una rama dedicada por tarea. Nunca desarrollar directamente en `main`.
2. No hacer push directo a `main`; los cambios deben pasar por una rama y revisión.
3. Inspeccionar antes de editar: estado de Git, estructura, documentación, scripts, configuración y código relacionado.
4. Para cualquier cambio en Next.js, leer primero la guía pertinente instalada en `node_modules/next/dist/docs/`. Esta versión puede diferir de conocimientos previos.
5. Confirmar el alcance solicitado y preservar cambios ajenos o no relacionados.

## Implementación

- Mantener los cambios pequeños, trazables y estrictamente acotados a la tarea.
- Conservar la arquitectura actual de Next.js y TypeScript en modo `strict`; no debilitar tipos ni controles para sortear errores.
- Preferir Server Components y ejecución del lado servidor cuando la arquitectura y las guías instaladas de Next.js así lo indiquen.
- Validar del lado servidor toda entrada no confiable, incluso si también existe validación en cliente.
- Autorización y autenticación son controles de servidor; ocultar elementos en la interfaz nunca sustituye esos controles.
- No exponer secretos, tokens, llaves privadas, credenciales ni variables sensibles en el repositorio, logs, bundles del cliente o respuestas públicas.
- Cuando se implemente Supabase, habilitar RLS en toda tabla expuesta y definir políticas explícitas de mínimo privilegio antes de usarla desde la aplicación.
- Calcular y validar precios, descuentos, impuestos, envío y totales exclusivamente en el servidor. Nunca confiar en importes enviados por el cliente.
- No usar llaves, webhooks, endpoints ni datos de producción o tipo `live` en staging.
- No introducir funcionalidad, dependencias o refactors fuera del objetivo acordado.

## Ambientes

- Staging y producción deben usar proyectos, secretos, datos y despliegues separados.
- La organización prevista de Supabase es `daboto-creator's Org`.
- El proyecto de prueba previsto es `peter-golf-staging`.
- El proyecto futuro de producción será `peter-golf-production`.
- No crear ni configurar recursos externos sin autorización explícita.

## Validación obligatoria

Al terminar cada tarea se deben ejecutar:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Si un script aún no existe, no se debe inventar ni omitir silenciosamente: hay que reportarlo como riesgo o bloqueo y, cuando sea posible, ejecutar un equivalente seguro sin cambiar el alcance.

## Entrega

El reporte final debe incluir:

- resumen del resultado;
- archivos modificados;
- pruebas y comandos ejecutados, con su resultado;
- supuestos realizados;
- riesgos, bloqueos y decisiones pendientes.

No hacer commit ni push salvo petición explícita.
