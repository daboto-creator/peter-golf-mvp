import "server-only";

import { notificationEmailConfig, serverEnv } from "@/env/server";
import {
  deterministicMessageId,
  isRecipientAllowed,
  sanitizeNotificationError,
  type NotificationEventType,
} from "@/lib/notifications/notification-rules";
import { createSmtpTransport } from "@/lib/notifications/smtp-transport";
import { renderNotificationTemplate } from "@/lib/notifications/templates";
import { createClient } from "@/lib/supabase/server";

export type DispatchResult = {
  claimed: number;
  sent: number;
  failed: number;
  disabled: boolean;
};

export async function dispatchPendingNotifications(
  limit = 20,
): Promise<DispatchResult> {
  if (serverEnv.NOTIFICATIONS_MODE !== "test") {
    return { claimed: 0, sent: 0, failed: 0, disabled: true };
  }
  if (!notificationEmailConfig) {
    throw new Error("notification_configuration_invalid");
  }
  const client = await createClient();
  const { data, error } = await client.rpc("claim_notification_deliveries", {
    requested_limit: limit,
  });
  if (error) throw new Error("notification_claim_failed");

  let transport: ReturnType<typeof createSmtpTransport> | null = null;
  let transportError: unknown = null;
  try {
    transport = createSmtpTransport();
  } catch (caught) {
    transportError = caught;
  }

  let sent = 0;
  let failed = 0;
  for (const delivery of data) {
    try {
      if (
        !isRecipientAllowed(
          delivery.recipient_email,
          notificationEmailConfig.EMAIL_ALLOWED_RECIPIENT_DOMAINS,
        )
      ) {
        throw Object.assign(new Error("Recipient domain is not allowed."), {
          code: "recipient_domain_not_allowed",
        });
      }
      if (!transport)
        throw transportError ?? new Error("Transport unavailable");
      const messageId = deterministicMessageId(delivery.delivery_id);
      let rendered;
      try {
        rendered = renderNotificationTemplate({
          eventType: delivery.event_type as NotificationEventType,
          customerName: delivery.customer_name,
          orderId: delivery.order_id,
          templateData: delivery.template_data,
          occurredAt: delivery.occurred_at,
          appUrl: serverEnv.NEXT_PUBLIC_APP_URL,
        });
      } catch {
        throw Object.assign(new Error("Notification template is invalid."), {
          code: "template_invalid",
        });
      }
      const result = await transport.send({
        to: delivery.recipient_email,
        from: {
          name: notificationEmailConfig.EMAIL_FROM_NAME,
          address: notificationEmailConfig.EMAIL_FROM_ADDRESS,
        },
        ...rendered,
        messageId,
      });
      const completion = await client.rpc("complete_notification_delivery", {
        requested_lease_token: delivery.lease_token,
        requested_provider_message_id: result.messageId,
      });
      if (completion.error) throw new Error("notification_completion_failed");
      sent += 1;
    } catch (caught) {
      const explicitCode =
        caught && typeof caught === "object" && "code" in caught
          ? String((caught as { code: unknown }).code)
          : null;
      const code = explicitCode?.match(/^[a-z0-9_]{1,80}$/)
        ? explicitCode
        : sanitizeNotificationError(caught);
      const failure = await client.rpc("fail_notification_delivery", {
        requested_lease_token: delivery.lease_token,
        requested_error_code: code,
      });
      if (failure.error) {
        // Keep processing other claimed deliveries. The lease recovery path
        // safely returns this row to the queue after five minutes.
      }
      failed += 1;
    }
  }
  return { claimed: data.length, sent, failed, disabled: false };
}
