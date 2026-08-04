import "server-only";

import nodemailer from "nodemailer";

import { notificationEmailConfig } from "@/env/server";
import type {
  NotificationMessage,
  NotificationTransport,
} from "@/lib/notifications/transport";

export function createSmtpTransport(): NotificationTransport {
  if (!notificationEmailConfig) {
    throw Object.assign(
      new Error("Notification transport is not configured."),
      {
        code: "transport_disabled",
      },
    );
  }
  if (
    !["127.0.0.1", "localhost", "::1"].includes(
      notificationEmailConfig.SMTP_HOST,
    )
  ) {
    throw Object.assign(new Error("Only local SMTP is allowed in test mode."), {
      code: "transport_disabled",
    });
  }
  const transporter = nodemailer.createTransport({
    host: notificationEmailConfig.SMTP_HOST,
    port: notificationEmailConfig.SMTP_PORT,
    secure: notificationEmailConfig.SMTP_SECURE,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return {
    async send(message: NotificationMessage) {
      const result = await transporter.sendMail(message);
      return { messageId: result.messageId || message.messageId };
    },
  };
}
