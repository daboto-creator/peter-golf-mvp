import "server-only";

export type NotificationMessage = {
  to: string;
  from: { name: string; address: string };
  subject: string;
  text: string;
  html: string;
  messageId: string;
};

export type NotificationTransport = {
  send(message: NotificationMessage): Promise<{ messageId: string }>;
};
