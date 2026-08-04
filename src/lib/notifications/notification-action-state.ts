export type NotificationActionResult = {
  status: "idle" | "success" | "error";
  message: string;
};

export const initialNotificationActionResult: NotificationActionResult = {
  status: "idle",
  message: "",
};
