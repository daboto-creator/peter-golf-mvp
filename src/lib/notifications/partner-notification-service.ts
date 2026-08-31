import "server-only";

export type PartnerNotification = {
  eventType: string;
  subject: string;
  bodyText: string;
  deduplicationKey: string;
};

export interface PartnerNotificationChannel<TRecipient> {
  readonly name: string;
  enqueue(
    recipient: TRecipient,
    notification: PartnerNotification,
  ): Promise<void>;
}

// Database outbox rows are the MVP delivery contract for INTERNAL and EMAIL.
// A future WhatsApp adapter can implement this interface without changing the
// onboarding or review domain services.
