import { describe, expect, it } from "vitest";

import {
  fulfillmentStatusLabel,
  listingStatusLabel,
  payableStatusLabel,
  pricingViabilityLabel,
} from "@/lib/marketplace/presentation";

describe("Marketplace friendly presentation", () => {
  it("maps Partner fulfillment without exposing internal enums", () => {
    expect(fulfillmentStatusLabel.PENDING_CONFIRMATION).toBe(
      "Confirma disponibilidad",
    );
    expect(fulfillmentStatusLabel.READY_FOR_CARRIER).toBe("Listo para enviar");
  });

  it("maps publication, pricing and payment states", () => {
    expect(listingStatusLabel.CHANGES_REQUESTED).toBe("Requiere ajustes");
    expect(pricingViabilityLabel.INSUFFICIENT_DATA).toBe(
      "Falta analizar precio de mercado",
    );
    expect(payableStatusLabel.AVAILABLE).toBe("Disponible para pago");
  });
});
