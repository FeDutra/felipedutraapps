import type { Timestamp, FieldValue } from "firebase-admin/firestore";

export type SubscriberStatus = "pending" | "active" | "unsubscribed" | "error";

export type DeliveryStatus =
  | "queued"
  | "confirmation_sent"
  | "welcome_sent"
  | "failed";

export interface CorrespondenceSubscriber {
  id: string; // SHA-256 of normalized email
  name: string | null;
  email: string; // Normalized email
  source: string;
  status: SubscriberStatus;
  consentAt: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  confirmedAt: Timestamp | FieldValue | null;
  unsubscribedAt: Timestamp | FieldValue | null;
  lastDeliveryStatus: DeliveryStatus | string | null;
  lastDeliveryAt: Timestamp | FieldValue | null;
  errorCode: string | null;
  confirmationTokenHash: string | null;
  confirmationExpiresAt: Timestamp | FieldValue | null;
  unsubscribeTokenHash?: string | null;
}

export interface SubscribeRequestBody {
  action?: string;
  name?: string;
  email?: string;
  consent?: boolean | string;
  source?: string;
  honeypot?: string;
}
