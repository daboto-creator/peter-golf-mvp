import { z } from "zod";

export type StripeCheckoutActionResult = {
  status: "idle" | "error";
  message: string;
};

export const initialStripeCheckoutActionResult: StripeCheckoutActionResult = {
  status: "idle",
  message: "",
};

export const stripeCheckoutRequestSchema = z.object({
  orderId: z.uuid(),
  idempotencyKey: z.uuid(),
});

export function getStripeCheckoutFormText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export function getStripeCheckoutFailure(
  code?: string,
): StripeCheckoutActionResult {
  if (code === "22023") {
    return {
      status: "error",
      message: "El pedido aún no está listo para pagar o ya fue pagado.",
    };
  }
  if (code === "P0002") {
    return { status: "error", message: "El pago no está disponible." };
  }
  if (code === "42501") {
    return {
      status: "error",
      message: "Stripe Checkout de prueba está deshabilitado.",
    };
  }
  return {
    status: "error",
    message: "No pudimos preparar el pago. Inténtalo nuevamente.",
  };
}
