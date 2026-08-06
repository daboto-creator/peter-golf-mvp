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

export const stripeCheckoutExpirationSeconds = 30 * 60 + 3;

export type StripeCheckoutDiagnosticStage =
  "prepare" | "stripe_create" | "attach" | "redirect";

type StripeCheckoutDiagnostic = {
  category:
    | "application"
    | "database"
    | "validation"
    | "stripe_api"
    | "stripe_authentication"
    | "stripe_card"
    | "stripe_connection"
    | "stripe_idempotency"
    | "stripe_invalid_request"
    | "stripe_permission"
    | "stripe_rate_limit"
    | "stripe_unknown";
  stripeErrorType?: string;
  code?: string;
  statusCode?: number;
  param?: string;
  requestId?: string;
  stage: StripeCheckoutDiagnosticStage;
};

const stripeErrorCategories = {
  StripeAPIError: "stripe_api",
  StripeAuthenticationError: "stripe_authentication",
  StripeCardError: "stripe_card",
  StripeConnectionError: "stripe_connection",
  StripeIdempotencyError: "stripe_idempotency",
  StripeInvalidRequestError: "stripe_invalid_request",
  StripePermissionError: "stripe_permission",
  StripeRateLimitError: "stripe_rate_limit",
  StripeUnknownError: "stripe_unknown",
} as const satisfies Record<string, StripeCheckoutDiagnostic["category"]>;

function getRecordValue(error: unknown, key: string) {
  if (!error || typeof error !== "object") return undefined;
  try {
    return Reflect.get(error, key) as unknown;
  } catch {
    return undefined;
  }
}

function getSafeString(
  error: unknown,
  key: string,
  pattern: RegExp,
): string | undefined {
  const value = getRecordValue(error, key);
  return typeof value === "string" && pattern.test(value) ? value : undefined;
}

export function getStripeCheckoutExpiresAt(nowMs = Date.now()) {
  return Math.ceil(nowMs / 1000) + stripeCheckoutExpirationSeconds;
}

export function sanitizeStripeCheckoutError(
  error: unknown,
  stage: StripeCheckoutDiagnosticStage,
): StripeCheckoutDiagnostic {
  const stripeErrorType = getSafeString(
    error,
    "type",
    /^Stripe[A-Za-z]+Error$/,
  );
  const stripeCategory = stripeErrorType
    ? stripeErrorCategories[
        stripeErrorType as keyof typeof stripeErrorCategories
      ]
    : undefined;
  const code = getSafeString(error, "code", /^[A-Za-z0-9_.-]{1,64}$/);
  const statusCodeValue = getRecordValue(error, "statusCode");
  const param = getSafeString(error, "param", /^[A-Za-z0-9_.[\]-]{1,128}$/);
  const requestId = getSafeString(
    error,
    "requestId",
    /^req_[A-Za-z0-9]{1,64}$/,
  );

  return {
    category:
      stripeCategory ??
      (stage === "prepare" || stage === "attach"
        ? "database"
        : stage === "redirect"
          ? "validation"
          : "application"),
    ...(stripeCategory ? { stripeErrorType } : {}),
    ...(code ? { code } : {}),
    ...(typeof statusCodeValue === "number" &&
    Number.isInteger(statusCodeValue) &&
    statusCodeValue >= 100 &&
    statusCodeValue <= 599
      ? { statusCode: statusCodeValue }
      : {}),
    ...(param ? { param } : {}),
    ...(requestId ? { requestId } : {}),
    stage,
  };
}

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
