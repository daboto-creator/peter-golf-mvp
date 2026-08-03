export type CartActionResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialCartActionResult: CartActionResult = {
  status: "idle",
  message: "",
};
