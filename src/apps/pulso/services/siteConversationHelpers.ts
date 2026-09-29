import type {
  SiteConversationFilter,
  SiteConversationMetrics,
  SiteConversationRequestStatus,
  SiteConversationSummary
} from '../types/siteConversation.types';

export function toSiteConversationDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === 'object') {
    const timestampLike = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestampLike.toDate === 'function') return timestampLike.toDate();
    if (typeof timestampLike.seconds === 'number') return new Date(timestampLike.seconds * 1000);
  }
  const parsed = value instanceof Date
    ? value
    : typeof value === 'string' || typeof value === 'number'
      ? new Date(value)
      : new Date(Number.NaN);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatSiteConversationDate(value: unknown): string {
  const date = toSiteConversationDate(value);
  if (!date) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function isConversationUnread(lastMessageAt: unknown, internalLastReadAt: unknown): boolean {
  const lastMessage = toSiteConversationDate(lastMessageAt)?.getTime() ?? 0;
  const lastRead = toSiteConversationDate(internalLastReadAt)?.getTime() ?? 0;
  return lastMessage > lastRead;
}

export function mapSiteConversationRequestStatus(raw?: string | null): SiteConversationRequestStatus {
  if (['completed', 'success', 'proposal_ready', 'waiting_user_approval'].includes(raw || '')) {
    return 'success';
  }
  if (['running', 'processing', 'processing_openclaw', 'processing_by_openclaw'].includes(raw || '')) {
    return 'running';
  }
  if (['failed', 'error', 'openclaw_failed'].includes(raw || '')) return 'error';
  return 'queued';
}

export function computeSiteConversationMetrics(
  conversations: SiteConversationSummary[]
): SiteConversationMetrics {
  return conversations.reduce<SiteConversationMetrics>((metrics, conversation) => {
    metrics.total += 1;
    if (conversation.unread) metrics.unread += 1;
    if (conversation.status === 'active') metrics.active += 1;
    if (conversation.latestRequestStatus === 'error') metrics.errors += 1;
    return metrics;
  }, { total: 0, unread: 0, active: 0, errors: 0 });
}

export function filterSiteConversations(
  conversations: SiteConversationSummary[],
  filter: SiteConversationFilter,
  search: string
): SiteConversationSummary[] {
  const query = search.trim().toLocaleLowerCase('pt-BR');

  return conversations.filter((conversation) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && conversation.unread) ||
      (filter === 'active' && conversation.status === 'active') ||
      (filter === 'error' && conversation.latestRequestStatus === 'error');

    if (!matchesFilter) return false;
    if (!query) return true;

    return [conversation.visitorName, conversation.visitorEmail, conversation.preview]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(query));
  });
}
