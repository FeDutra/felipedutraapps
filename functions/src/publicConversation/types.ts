export type PublicConversationStatus = "queued" | "running" | "success" | "error";

export interface MessageRequestBody {
  action: "message";
  name?: string;
  email?: string;
  message: string;
  conversationId?: string;
  sessionToken?: string;
  website?: string;
}

export interface MessageSuccessResponse {
  status: "queued";
  conversationId: string;
  sessionToken?: string;
  requestId: string;
}

export interface StatusResponse {
  status: PublicConversationStatus;
  responseText?: string;
}

export interface PublicConversationDoc {
  conversationId: string;
  tokenHash: string;
  createdAt: any;
  updatedAt: any;
  lastMessageAt: any;
  messageCountHour: number;
  hourWindowStart: any;
  totalMessages: number;
  status: "active" | "blocked";
  latestRequestId: string;
  visitorName?: string | null;
  visitorEmail?: string | null;
}

export interface PublicConversationHistoryEntry {
  requestId: string;
  userText: string;
  responseText?: string;
  status: PublicConversationStatus;
}

export interface PublicConversationRequestOwnership {
  requestId: string;
  conversationId: string;
  createdAt: any;
  status: string;
}

export interface RateLimitConfig {
  cooldownMs: number;
  maxPerHour: number;
}
