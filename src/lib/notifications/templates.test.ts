import { describe, expect, it } from "vitest";

import { notificationEventTypes } from "@/lib/notifications/notification-rules";
import {
  escapeHtml,
  renderNotificationTemplate,
} from "@/lib/notifications/templates";

const base = {
  customerName: "Ana <script>alert(1)</script>",
  orderId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  templateData: {
    order_number: "PG-W-ABC123",
    origin: "web" as const,
    total: 125000,
    currency: "MXN",
    expected_amount: 125000,
    payment_currency: "MXN",
  },
  occurredAt: "2026-08-03T18:00:00.000Z",
  appUrl: "http://localhost:3000",
};

describe("notification templates", () => {
  it.each(notificationEventTypes)(
    "renders approved content for %s",
    (eventType) => {
      const rendered = renderNotificationTemplate({ ...base, eventType });
      expect(rendered.subject).toContain("[PRUEBA]");
      expect(rendered.subject).toContain("PG-W-ABC123");
      expect(rendered.text).toContain(
        "Mensaje de prueba. No realizar una transferencia real",
      );
      expect(rendered.html).toContain(
        "Mensaje de prueba. No realizar una transferencia real",
      );
      expect(rendered.html).not.toContain("<script>");
      expect(rendered.html).toContain("&lt;script&gt;");
    },
  );

  it("includes a customer URL only for web orders", () => {
    const web = renderNotificationTemplate({
      ...base,
      eventType: "order_created",
    });
    const manual = renderNotificationTemplate({
      ...base,
      eventType: "order_created",
      templateData: { ...base.templateData, origin: "manual" },
    });
    expect(web.text).toContain(
      "http://localhost:3000/cuenta/pedidos/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    );
    expect(manual.text).not.toContain("/cuenta/pedidos/");
  });

  it("formats relevant amounts as MXN", () => {
    const rendered = renderNotificationTemplate({
      ...base,
      eventType: "payment_paid",
    });
    expect(rendered.text).toMatch(/\$1,250\.00/);
  });

  it("does not render prohibited operational or payment fields", () => {
    const rendered = renderNotificationTemplate({
      ...base,
      eventType: "payment_rejected",
    });
    const combined = `${rendered.subject}\n${rendered.text}\n${rendered.html}`;
    for (const forbidden of [
      "CLABE",
      "internal_note",
      "cancellation_reason",
      "sender_bank",
      "transfer_reference",
      "inventory",
      "cost",
      "idempotency",
    ]) {
      expect(combined.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("escapes all HTML-sensitive characters", () => {
    expect(escapeHtml(`<a title="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a title=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });
});
