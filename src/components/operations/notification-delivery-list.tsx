"use client";

import { useActionState } from "react";

import { CatalogFeedback } from "@/components/operations/catalog-feedback";
import { Button } from "@/components/ui/button";
import {
  notificationEventLabels,
  type NotificationEventType,
} from "@/lib/notifications/notification-rules";
import {
  processPendingNotificationsAction,
  retryFailedNotificationsAction,
} from "@/lib/notifications/notification-actions";
import { initialNotificationActionResult } from "@/lib/notifications/notification-action-state";
import type { OperationalNotificationDelivery } from "@/lib/notifications/operational-notifications";

const statusLabels = {
  pending: "Pendiente",
  processing: "Procesando",
  sent: "Enviada",
  failed: "Fallida",
  dead_letter: "Sin más reintentos",
};

export function NotificationDeliveryList({
  deliveries,
  mode,
}: {
  deliveries: OperationalNotificationDelivery[];
  mode: "disabled" | "test";
}) {
  const [processState, processAction, processing] = useActionState(
    processPendingNotificationsAction,
    initialNotificationActionResult,
  );
  const [retryState, retryAction, retrying] = useActionState(
    retryFailedNotificationsAction,
    initialNotificationActionResult,
  );
  const feedback = retryState.message ? retryState : processState;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <form action={processAction}>
          <Button type="submit" disabled={processing || mode !== "test"}>
            {processing ? "Procesando…" : "Procesar pendientes"}
          </Button>
        </form>
        <form action={retryAction}>
          <Button
            type="submit"
            variant="outline"
            disabled={retrying || mode !== "test"}
          >
            {retrying ? "Reintentando…" : "Reintentar fallidas"}
          </Button>
        </form>
        <span className="text-muted-foreground text-sm">
          Modo: {mode === "test" ? "prueba local" : "deshabilitado"}
        </span>
      </div>
      {feedback.message ? (
        <CatalogFeedback
          tone={feedback.status === "error" ? "error" : "success"}
          message={feedback.message}
        />
      ) : null}
      {deliveries.length === 0 ? (
        <div className="rounded-xl border bg-white p-6">
          <p className="font-medium">No hay entregas en la cola.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Los pedidos sin correo conservan su evento, pero no crean entrega.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <Header>Pedido</Header>
                <Header>Evento</Header>
                <Header>Correo</Header>
                <Header>Estado</Header>
                <Header>Intentos</Header>
                <Header>Próxima ejecución</Header>
                <Header>Actualizada</Header>
                <Header>Error</Header>
              </tr>
            </thead>
            <tbody className="divide-y">
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <Cell>{delivery.orderNumber}</Cell>
                  <Cell>
                    {
                      notificationEventLabels[
                        delivery.eventType as NotificationEventType
                      ]
                    }
                    <span className="text-muted-foreground mt-1 block text-xs">
                      {date(delivery.occurredAt)}
                    </span>
                  </Cell>
                  <Cell>{delivery.recipientEmailMasked}</Cell>
                  <Cell>{statusLabels[delivery.status]}</Cell>
                  <Cell>
                    {delivery.attemptCount}/{delivery.maxAttempts}
                  </Cell>
                  <Cell>
                    {delivery.nextAttemptAt
                      ? date(delivery.nextAttemptAt)
                      : "—"}
                  </Cell>
                  <Cell>{date(delivery.updatedAt)}</Cell>
                  <Cell>{delivery.lastErrorCode ?? "—"}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-4 align-top">{children}</td>;
}

function date(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
