import "server-only";

import nodemailer from "nodemailer";

import { serverEnv } from "@/env/server";
import type {
  NotificationMessage,
  NotificationTransport,
} from "@/lib/notifications/transport";

export function createSmtpTransport(): NotificationTransport {
  if (!["127.0.0.1", "localhost", "::1"].includes(serverEnv.SMTP_HOST)) {
    throw Object.assign(new Error("Only local SMTP is allowed in test mode."), {
      code: "transport_disabled",
    });
  }
  const transporter = nodemailer.createTransport({
    host: serverEnv.SMTP_HOST,
    port: serverEnv.SMTP_PORT,
    secure: serverEnv.SMTP_SECURE,
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
