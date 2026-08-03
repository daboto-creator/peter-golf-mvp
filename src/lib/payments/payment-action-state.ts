export type PaymentActionResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialPaymentActionResult: PaymentActionResult = {
  status: "idle",
  message: "",
};
