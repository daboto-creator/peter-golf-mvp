"use server";

import { revalidatePath } from "next/cache";

import { serverEnv } from "@/env/server";
import { requireOrdersManager } from "@/lib/auth/order-authorization";
import { dispatchPendingNotifications } from "@/lib/notifications/dispatcher";
import type { NotificationActionResult } from "@/lib/notifications/notification-action-state";
import { createClient } from "@/lib/supabase/server";

export async function processPendingNotificationsAction(
  _state: NotificationActionResult,
): Promise<NotificationActionResult> {
  void _state;
  await requireOrdersManager("/operacion/notificaciones");
  if (serverEnv.NOTIFICATIONS_MODE !== "test") {
    return {
      status: "error",
      message: "Las notificaciones están deshabilitadas en este ambiente.",
    };
  }
  try {
    const result = await dispatchPendingNotifications();
    if (result.disabled) {
      return {
        status: "error",
        message: "Las notificaciones están deshabilitadas en este ambiente.",
      };
    }
    revalidatePath("/operacion/notificaciones");
    return {
      status: "success",
      message: `Procesadas ${result.claimed}: ${result.sent} enviadas y ${result.failed} fallidas.`,
    };
  } catch {
    return {
      status: "error",
      message: "No pudimos procesar la cola de notificaciones.",
    };
  }
}

export async function retryFailedNotificationsAction(
  _state: NotificationActionResult,
): Promise<NotificationActionResult> {
  void _state;
  await requireOrdersManager("/operacion/notificaciones");
  if (serverEnv.NOTIFICATIONS_MODE !== "test") {
    return {
      status: "error",
      message: "Las notificaciones están deshabilitadas en este ambiente.",
    };
  }
  try {
    const client = await createClient();
    const { data, error } = await client.rpc(
      "retry_failed_notification_deliveries",
    );
    if (error) throw error;
    const result = await dispatchPendingNotifications();
    revalidatePath("/operacion/notificaciones");
    return {
      status: "success",
      message: `Reintentos habilitados: ${data}. Enviadas: ${result.sent}; fallidas: ${result.failed}.`,
    };
  } catch {
    return {
      status: "error",
      message: "No pudimos reintentar las entregas fallidas.",
    };
  }
}
