import type { Metadata } from "next";

import { NotificationDeliveryList } from "@/components/operations/notification-delivery-list";
import { serverEnv } from "@/env/server";
import { requireOrdersManager } from "@/lib/auth/order-authorization";
import { listOperationalNotificationDeliveries } from "@/lib/notifications/operational-notifications";

export const metadata: Metadata = {
  title: "Notificaciones | Operación | Peter Golf",
};

export default async function OperationalNotificationsPage() {
  await requireOrdersManager("/operacion/notificaciones");
  const deliveries = await listOperationalNotificationDeliveries();
  return (
    <div className="space-y-7">
      <header>
        <p className="text-pg-gold text-xs font-semibold tracking-[0.18em] uppercase">
          Entrega local y de prueba
        </p>
        <h1 className="text-pg-black mt-3 text-4xl font-semibold tracking-[-0.035em]">
          Notificaciones
        </h1>
        <p className="text-muted-foreground mt-3 max-w-3xl leading-7">
          Procesa la outbox transaccional hacia Inbucket. El correo se envía
          después del commit y una falla nunca revierte pedidos, pagos o
          inventario.
        </p>
      </header>
      {deliveries ? (
        <NotificationDeliveryList
          deliveries={deliveries}
          mode={serverEnv.NOTIFICATIONS_MODE}
        />
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          No pudimos consultar la cola de notificaciones.
        </div>
      )}
    </div>
  );
}
