export type CorrespondenceStatus = "pending" | "active" | "unsubscribed" | "error";

export interface CorrespondenceSubscriberClient {
  id: string; // SHA-256 hash of normalized email
  name: string | null;
  email: string;
  source: string;
  status: CorrespondenceStatus;
  consentAt?: any;
  createdAt?: any;
  updatedAt?: any;
  confirmedAt?: any | null;
  unsubscribedAt?: any | null;
  lastDeliveryStatus?: string | null;
  lastDeliveryAt?: any | null;
  errorCode?: string | null;
}

export interface CorrespondenceMetrics {
  total: number;
  active: number;
  pending: number;
  error: number;
  unsubscribed: number;
}

export type StatusFilterOption = "all" | CorrespondenceStatus;
