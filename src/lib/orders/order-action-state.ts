export type OrderActionResult = {
  status: "idle" | "error";
  message: string;
};

export const initialOrderActionResult: OrderActionResult = {
  status: "idle",
  message: "",
};
