import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

export type OperationalNotificationDelivery = {
  id: string;
  orderNumber: string;
  eventType: Database["public"]["Enums"]["notification_event_type"];
  recipientEmailMasked: string;
  status: Database["public"]["Enums"]["notification_delivery_status"];
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  processingStartedAt: string | null;
  sentAt: string | null;
  lastErrorCode: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export async function listOperationalNotificationDeliveries(): Promise<
  OperationalNotificationDelivery[] | null
> {
  try {
    const client = await createClient();
    const { data, error } = await client.rpc(
      "list_operational_notification_deliveries",
      { requested_limit: 200 },
    );
    if (error) return null;
    return data.map((delivery) => ({
      id: delivery.delivery_id,
      orderNumber: delivery.order_number,
      eventType: delivery.event_type,
      recipientEmailMasked: delivery.recipient_email_masked,
      status: delivery.status,
      attemptCount: delivery.attempt_count,
      maxAttempts: delivery.max_attempts,
      nextAttemptAt: delivery.next_attempt_at,
      processingStartedAt: delivery.processing_started_at,
      sentAt: delivery.sent_at,
      lastErrorCode: delivery.last_error_code,
      occurredAt: delivery.occurred_at,
      createdAt: delivery.created_at,
      updatedAt: delivery.updated_at,
    }));
  } catch {
    return null;
  }
}
