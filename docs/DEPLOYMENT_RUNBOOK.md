# Runbook de despliegue

## 1. Alcance

Procedimiento base para despliegues futuros de Peter Golf. No selecciona proveedor, no crea infraestructura y no configura Supabase. La plataforma de hosting y el pipeline definitivo están pendientes.

## 2. Ambientes

| Ambiente | Propósito | Datos y secretos |
| --- | --- | --- |
| Local | Desarrollo individual | Valores locales no reales |
| Staging | Integración y prueba del MVP sin pagos | Datos ficticios; nunca llaves live |
| Producción | Operación real futura | Secretos exclusivos de producción |

Supabase previsto, aún no creado:

- Organización: `daboto-creator's Org`
- Staging: `peter-golf-staging`
- Producción: `peter-golf-production`

## 3. Responsables

Con un equipo de dos personas:

- una persona ejecuta o supervisa el despliegue;
- la otra revisa checklist, smoke tests y decisión de continuar o revertir.

Para cambios de alto riesgo se requiere revisión de ambas. Deben definirse propietarios y contactos antes del primer despliegue público.

## 4. Preparación

1. Confirmar rama y revisión aprobada; no desplegar cambios directos desde `main` sin el flujo acordado.
2. Revisar diff, migraciones futuras, dependencias y riesgos.
3. Confirmar que no hay secretos ni archivos `.env` versionados.
4. Verificar que variables corresponden al ambiente y que staging no usa valores live.
5. Confirmar respaldo y punto de restauración antes de cambios de datos futuros.
6. Ejecutar:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

En el estado actual no existen `typecheck` ni `test`; se debe usar `npx tsc --noEmit`, reportar la falta y no afirmar que hubo pruebas automatizadas.

## 5. Despliegue a staging

1. Desplegar el artefacto inmutable asociado al commit revisado.
2. Aplicar migraciones futuras mediante proceso versionado y compatible.
3. Confirmar estado saludable y revisar logs sin datos sensibles.
4. Ejecutar smoke tests:
   - carga de inicio y rutas públicas;
   - recursos estáticos;
   - estados de error;
   - flujo de asesoría futuro;
   - intención de compra sin pago;
   - ausencia de captura o proveedor de pagos;
   - controles de acceso y RLS cuando aplique.
5. Registrar versión, responsable, hora, resultado y defectos.

## 6. Promoción futura a producción

Sólo después de aprobación explícita:

1. Confirmar criterios de aceptación, revisión de seguridad y políticas legales.
2. Verificar variables y recursos exclusivos de producción.
3. Revisar compatibilidad de cambios de base de datos y plan de rollback.
4. Desplegar la misma versión validada en staging.
5. Ejecutar smoke tests que no creen cargos ni alteren datos reales indebidamente.
6. Monitorear errores, latencia y flujos críticos durante la ventana acordada.

El MVP inicial no debe promover una experiencia que parezca aceptar pagos reales.

## 7. Rollback

Revertir ante indisponibilidad, pérdida/corrupción de datos, exposición de información, falla de autorización, cálculo incorrecto de importes o error crítico del flujo.

1. Detener promociones y operaciones riesgosas.
2. Revertir al último artefacto saludable.
3. Para datos, usar la estrategia compatible previamente probada; no improvisar migraciones destructivas.
4. Revocar y rotar secretos si existe posible exposición.
5. Verificar recuperación con smoke tests.
6. Documentar impacto, línea de tiempo, causa y acciones correctivas.

## 8. Incidentes

- Priorizar seguridad de personas y datos sobre continuidad.
- Preservar evidencia sin copiar secretos en tickets o chats.
- Notificar a los responsables definidos.
- Comunicar sólo hechos confirmados y actualizar con cadencia acordada.
- Realizar retrospectiva sin culpa y convertir acciones en tareas trazables.

## 9. Decisiones pendientes

- Proveedor de hosting, dominios y DNS.
- CI/CD, aprobaciones y estrategia de ramas.
- Observabilidad, alertas y contacto de guardia.
- Backups, objetivos RPO/RTO y prueba de restauración.
- Gestión de migraciones y datos semilla.
- Políticas legales, privacidad y operación de producción.
- Estrategia futura de pagos, fuera del MVP inicial.
