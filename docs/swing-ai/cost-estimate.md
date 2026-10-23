# Estimación de costos

Precios consultados el 23 de octubre de 2026. Son supuestos de planeación, no
cotizaciones; deben actualizarse antes de contratar.

## Supuestos

- clip promedio 20 MB, retención bruta 7 días;
- una carga y, en fallback servidor, una lectura no cacheada;
- MediaPipe en navegador no genera costo de inferencia;
- Supabase Pro de referencia: USD 25 de plan + compute mostrado en su ejemplo,
  con 100 GB de Storage y 250 GB de egress incluidos;
- overage publicado: Storage USD 0.0213/GB-mes y egress no cacheado USD 0.09/GB;
- no se incluye desarrollo, soporte, impuestos ni revisión jurídica.

Fuentes: [Supabase pricing](https://supabase.com/pricing),
[Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[Hugging Face endpoints](https://huggingface.co/docs/inference-endpoints/pricing).

## Volumen mensual

| Análisis | Ingreso de video | Storage medio con 7 días | Egress fallback 1 lectura |
| -------: | ---------------: | -----------------------: | ------------------------: |
|      100 |             2 GB |                  0.47 GB |                      2 GB |
|      300 |             6 GB |                  1.40 GB |                      6 GB |
|    1,000 |            20 GB |                  4.67 GB |                     20 GB |

Estos volúmenes permanecen dentro de las cuotas publicadas de Pro si no compiten
con consumo elevado de otros módulos. Deben presupuestarse por organización, no
como cuota exclusiva de Swing AI.

## Escenarios

| Arquitectura                                   |                100 |    300 |  1,000 | Observación                                          |
| ---------------------------------------------- | -----------------: | -----: | -----: | ---------------------------------------------------- |
| MediaPipe browser + Supabase existente         | ~USD 0 incremental |     ~0 |     ~0 | mejor privacidad; costo base de plataforma ya existe |
| Total de plataforma usando referencia Supabase |         ~USD 30–40 | ~30–45 | ~30–55 | reserva operativa, dentro de USD 50–150              |
| CPU x4 scale-to-zero, 90 s/análisis            |   USD 0.34 compute |   1.01 |   3.35 | excluye cold start/minutos ociosos                   |
| CPU x4 siempre encendido                       |          USD 97.82 |  97.82 |  97.82 | más base: ~USD 128–153                               |
| GPU desde USD 0.50/h siempre encendido         |           USD 365+ |   365+ |   365+ | fuera del objetivo                                   |

El cálculo CPU usa USD 0.134/h y 90 s: `n × 90 / 3600 × 0.134`.
Un endpoint dedicado factura tiempo listo/inicializando; scale-to-zero puede reducir
costo pero añade cold start. Medir tiempo real antes de elegir tamaño.

## Recomendación

PR 2 debe probar MediaPipe Full en navegador y guardar sólo observaciones cuando
sea posible. Reservar USD 20 mensuales de kill-switch dentro del objetivo y no
activar fallback pagado sin dashboard de consumo, cuota global y alerta al 50/80/100%.

Vercel no debe transportar el video: Functions limita request/response a 4.5 MB.
El upload futuro va directo a Storage. Fuente:
[Vercel Functions limits](https://vercel.com/docs/functions/limitations).

## Decisiones pendientes

- ¿El costo base existente cuenta dentro de USD 50–150 o sólo incremental?
- Retención real y tamaño máximo.
- Dispositivos mínimos; si demasiados fallan, cambia la necesidad de servidor.
- Región/proveedor de fallback y tratamiento internacional de datos.
