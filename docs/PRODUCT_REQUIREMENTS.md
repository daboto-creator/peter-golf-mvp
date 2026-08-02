# Requisitos de producto

## 1. Resumen

Peter Golf es una tienda online de artículos de golf para clientes en México. Iniciará operaciones desde Querétaro, enviará a todo el país y combinará la venta de productos nuevos y seminuevos, disponibles en stock o sobre pedido.

Su diferenciador es la atención consultiva: el equipo acompañará al cliente para que elija una opción adecuada antes de cerrar la compra.

## 2. Objetivo del MVP

Validar que clientes potenciales pueden descubrir productos, entender su condición y disponibilidad, solicitar asesoría y expresar intención de compra. La primera prueba no procesará pagos reales ni confirmará automáticamente pedidos pagados.

## 3. Usuarios

- **Visitante/comprador:** persona en México interesada en equipo de golf y que puede requerir orientación.
- **Equipo operativo:** dos personas responsables de productos, asesoría, disponibilidad, seguimiento y coordinación de envíos.
- **Administrador futuro:** rol autorizado para mantener catálogo, inventario y solicitudes; no forma parte de la implementación actual.

## 4. Alcance funcional del MVP futuro

### Descubrimiento

- Consultar un catálogo público con categorías y datos esenciales.
- Distinguir claramente productos nuevos de seminuevos.
- Distinguir productos en stock de productos sobre pedido.
- Consultar detalle, precio de referencia vigente, imágenes, especificaciones y condición.
- Identificar restricciones, tiempos estimados y avisos aplicables.

### Asesoría e intención de compra

- Iniciar una solicitud de asesoría vinculada opcionalmente a un producto.
- Capturar únicamente los datos necesarios de contacto y contexto.
- Permitir al equipo dar seguimiento manual.
- Registrar una intención de compra o pedido de prueba sin cobro real.
- Permitir al equipo operativo registrar ventas manuales de canales controlados,
  confirmar existencias y cancelar con devolución auditable, sin pagos reales.
- Mostrar de forma inequívoca que el flujo de staging/MVP no realiza cargos.

### Operación

- Permitir que el equipo gestione información comercial mediante un mecanismo futuro autorizado.
- Controlar estado de disponibilidad y seguimiento sin prometer inventario inexistente.
- Mantener trazabilidad básica de cambios sensibles y estados.

## 5. Fuera de alcance en esta etapa documental

- Desarrollo de catálogo, autenticación, carrito, checkout o panel administrativo.
- Pagos reales, Stripe o cualquier otro servicio de pago.
- Creación o configuración de Supabase.
- Automatización de paqueterías, facturación, devoluciones o contabilidad.
- Aplicaciones móviles nativas, programa de lealtad o marketplace de terceros.

## 6. Requisitos no funcionales

- Interfaz responsive, accesible y en español de México.
- Importes mostrados en MXN y fechas/horas interpretables en la zona operativa.
- Arquitectura compatible con Next.js App Router y TypeScript estricto.
- Validación y autorización del lado servidor.
- Separación completa entre staging y producción.
- Rendimiento medible en conexiones móviles y degradación comprensible ante fallas.
- Privacidad por diseño y recopilación mínima de datos personales.

## 7. Indicadores iniciales

Las metas numéricas se definirán después de contar con una línea base. El MVP debe permitir medir, sin exponer datos personales:

- visitas a producto;
- solicitudes de asesoría iniciadas y completadas;
- intenciones de compra registradas;
- tiempo de primera respuesta del equipo;
- conversión de asesoría a intención de compra;
- consultas por productos sin stock o sobre pedido.

## 8. Dependencias y fases

1. **Actual:** documentación y scaffold técnico.
2. **MVP funcional:** experiencia de descubrimiento, asesoría e intención sin pagos reales.
3. **Persistencia:** evaluación e integración posterior con Supabase.
4. **Producción:** endurecimiento operativo y eventual evaluación de pagos reales.

Toda ampliación requiere criterios de aceptación y revisión de seguridad propios.
