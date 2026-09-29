import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/client';
import { firestorePaths } from './firestorePaths';
import {
  isConversationUnread,
  mapSiteConversationRequestStatus,
  toSiteConversationDate
} from './siteConversationHelpers';
import type {
  SiteConversationSummary,
  SiteConversationThread,
  SiteConversationTurn
} from '../types/siteConversation.types';

function extractResponseText(data: DocumentData): string | null {
  const candidate =
    data.openclawResult?.responseText ??
    data.result?.responseText ??
    data.result?.response ??
    data.responseText;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

async function readRequest(requestId?: string | null) {
  if (!requestId) return null;
  const snapshot = await getDoc(doc(db, firestorePaths.request(requestId)));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as DocumentData & { id: string };
}

function mapSummary(
  id: string,
  data: DocumentData,
  latestRequest: (DocumentData & { id: string }) | null
): SiteConversationSummary {
  return {
    id,
    visitorName: data.visitorName ?? null,
    visitorEmail: data.visitorEmail ?? null,
    status: data.status === 'blocked' ? 'blocked' : 'active',
    totalMessages: Number(data.totalMessages ?? 0),
    createdAt: data.createdAt ?? null,
    lastMessageAt: data.lastMessageAt ?? data.updatedAt ?? null,
    internalLastReadAt: data.internalLastReadAt ?? null,
    latestRequestId: data.latestRequestId ?? null,
    preview: String(latestRequest?.input ?? latestRequest?.rawInput ?? '').trim(),
    latestRequestStatus: latestRequest
      ? mapSiteConversationRequestStatus(latestRequest.status)
      : null,
    unread: isConversationUnread(
      data.lastMessageAt ?? data.updatedAt,
      data.internalLastReadAt
    )
  };
}

export const siteConversationService = {
  async getConversations(maxItems = 100): Promise<SiteConversationSummary[]> {
    const conversationsQuery = query(
      collection(db, firestorePaths.publicConversations()),
      orderBy('lastMessageAt', 'desc'),
      limit(maxItems)
    );
    const snapshot = await getDocs(conversationsQuery);
    const latestRequests = await Promise.all(
      snapshot.docs.map((conversation) => readRequest(conversation.data().latestRequestId))
    );

    return snapshot.docs.map((conversation, index) =>
      mapSummary(conversation.id, conversation.data(), latestRequests[index])
    );
  },

  async getThread(conversation: SiteConversationSummary): Promise<SiteConversationThread> {
    const ownershipQuery = query(
      collection(db, firestorePaths.publicConversationRequests(conversation.id)),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    const ownershipSnapshot = await getDocs(ownershipQuery);
    const requests = await Promise.all(
      ownershipSnapshot.docs.map((ownership) => readRequest(ownership.id))
    );

    const turns: SiteConversationTurn[] = requests
      .filter((request): request is DocumentData & { id: string } => Boolean(request))
      .map((request) => ({
        requestId: request.id,
        userText: String(request.input ?? request.rawInput ?? '').trim(),
        responseText: extractResponseText(request),
        status: mapSiteConversationRequestStatus(request.status),
        createdAt: request.createdAt ?? request.requestedAt ?? null,
        updatedAt: request.updatedAt ?? null
      }))
      .filter((turn) => turn.userText.length > 0)
      .sort((a, b) => {
        const aTime = toSiteConversationDate(a.createdAt)?.getTime() ?? 0;
        const bTime = toSiteConversationDate(b.createdAt)?.getTime() ?? 0;
        return aTime - bTime;
      });

    return { conversation, turns };
  },

  async markAsRead(conversationId: string, readBy: string): Promise<void> {
    await updateDoc(doc(db, firestorePaths.publicConversation(conversationId)), {
      internalLastReadAt: serverTimestamp(),
      internalReadBy: readBy
    });
  }
};
