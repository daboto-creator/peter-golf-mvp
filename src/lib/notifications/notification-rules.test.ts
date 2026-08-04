import { describe, expect, it } from "vitest";

import {
  deterministicMessageId,
  isPermanentNotificationError,
  isRecipientAllowed,
  notificationEventLabels,
  notificationEventTypes,
  retryDelayMs,
  sanitizeNotificationError,
} from "@/lib/notifications/notification-rules";

describe("notification rules", () => {
  it("maps the eight approved events", () => {
    expect(notificationEventTypes).toHaveLength(8);
    expect(Object.keys(notificationEventLabels)).toEqual(
      notificationEventTypes,
    );
    expect(notificationEventLabels.order_confirmed).toBe(
      "Pedido confirmado y en preparación",
    );
  });

  it("only accepts explicitly allowed recipient domains", () => {
    const allowed = ["example.test", "peter-golf.test"];
    expect(isRecipientAllowed(" ANA@EXAMPLE.TEST ", allowed)).toBe(true);
    expect(isRecipientAllowed("ana@sub.example.test", allowed)).toBe(false);
    expect(isRecipientAllowed("ana@example.com", allowed)).toBe(false);
    expect(isRecipientAllowed("invalid", allowed)).toBe(false);
  });

  it("uses the approved retry schedule", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMs)).toEqual([
      60_000,
      300_000,
      900_000,
      3_600_000,
      null,
    ]);
  });

  it("classifies permanent and retryable errors without raw details", () => {
    expect(isPermanentNotificationError("invalid_recipient")).toBe(true);
    expect(isPermanentNotificationError("smtp_permanent")).toBe(true);
    expect(isPermanentNotificationError("smtp_unavailable")).toBe(false);
    expect(sanitizeNotificationError({ code: "ECONNREFUSED" })).toBe(
      "smtp_unavailable",
    );
    expect(sanitizeNotificationError({ responseCode: 550 })).toBe(
      "smtp_permanent",
    );
    expect(sanitizeNotificationError(new Error("secret smtp response"))).toBe(
      "smtp_unknown",
    );
  });

  it("creates a deterministic local Message-ID", () => {
    expect(deterministicMessageId("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(
      "<notification-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee@peter-golf.test>",
    );
  });
});
