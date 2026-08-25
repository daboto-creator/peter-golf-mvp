export type PartnerActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialPartnerActionState: PartnerActionState = { status: "idle" };
