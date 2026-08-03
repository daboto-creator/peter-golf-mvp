export type AddressActionResult = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export const initialAddressActionResult: AddressActionResult = {
  status: "idle",
};
