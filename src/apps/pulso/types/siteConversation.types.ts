export type SiteConversationStatus = 'active' | 'blocked';
export type SiteConversationRequestStatus = 'queued' | 'running' | 'success' | 'error';

export interface SiteConversationSummary {
  id: string;
  visitorName: string | null;
  visitorEmail: string | null;
  status: SiteConversationStatus;
  totalMessages: number;
  createdAt: unknown;
  lastMessageAt: unknown;
  internalLastReadAt: unknown | null;
  latestRequestId: string | null;
  preview: string;
  latestRequestStatus: SiteConversationRequestStatus | null;
  unread: boolean;
}

export interface SiteConversationTurn {
  requestId: string;
  userText: string;
  responseText: string | null;
  status: SiteConversationRequestStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface SiteConversationThread {
  conversation: SiteConversationSummary;
  turns: SiteConversationTurn[];
}

export type SiteConversationFilter = 'all' | 'unread' | 'active' | 'error';

export interface SiteConversationMetrics {
  total: number;
  unread: number;
  active: number;
  errors: number;
}
