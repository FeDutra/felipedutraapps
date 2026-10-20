'use client';

import React from 'react';

interface ReadingMessage {
  id: string;
  sender: string;
  timestamp: Date;
  isProgressUpdate?: boolean;
}

interface UseConversationReadingAnchorOptions {
  contextId: string;
  lastReadAt?: string | null;
  messages: readonly ReadingMessage[];
  bottomOffset?: number;
  preferLatestOnEntry?: boolean;
}

const FOLLOW_THRESHOLD_PX = 120;
const ANCHOR_TOP_GAP_PX = 48;
const SETTLE_DELAYS_MS = [0, 80, 300, 700, 1500];

/**
 * Canonical reading behavior shared by the primary chat and every split pane.
 * A context captures its previous read boundary on entry, before the parent can
 * mark it as read. Delayed passes keep the anchor stable while rich content
 * (Markdown, images and attachments) finishes laying out.
 */
export function useConversationReadingAnchor({
  contextId,
  lastReadAt,
  messages,
  bottomOffset = 0,
  preferLatestOnEntry = false,
}: UseConversationReadingAnchorOptions) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const entryRef = React.useRef({ contextId: '', boundaryMs: 0, anchored: false });
  const nearLatestRef = React.useRef(true);
  const visibleAnchorRef = React.useRef<{ messageId: string; viewportOffset: number } | null>(null);
  const previousMessageCountRef = React.useRef(0);
  const [showReturnToLatest, setShowReturnToLatest] = React.useState(false);

  React.useLayoutEffect(() => {
    const parsedBoundary = lastReadAt ? new Date(lastReadAt).getTime() : 0;
    entryRef.current = {
      contextId,
      boundaryMs: Number.isFinite(parsedBoundary) ? parsedBoundary : 0,
      anchored: false,
    };
    previousMessageCountRef.current = 0;
    nearLatestRef.current = true;
    // `lastReadAt` is intentionally captured only when entering a context.
    // Later read-status writes must not move the reader away from this anchor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId]);

  const scrollToLatest = React.useCallback((smooth = true) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: Math.max(0, container.scrollHeight - container.clientHeight + bottomOffset),
      behavior: smooth ? 'smooth' : 'auto',
    });
    nearLatestRef.current = true;
    setShowReturnToLatest(false);
  }, [bottomOffset]);

  const handleScroll = React.useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    const isNearLatest = distance <= FOLLOW_THRESHOLD_PX;
    nearLatestRef.current = isNearLatest;
    setShowReturnToLatest(!isNearLatest);

    if (isNearLatest) {
      visibleAnchorRef.current = null;
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const visibleMessage = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))
      .find((element) => element.getBoundingClientRect().bottom > containerTop + ANCHOR_TOP_GAP_PX);
    visibleAnchorRef.current = visibleMessage?.dataset.messageId
      ? {
          messageId: visibleMessage.dataset.messageId,
          viewportOffset: visibleMessage.getBoundingClientRect().top - containerTop,
        }
      : null;
  }, []);

  React.useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;

    let previousWidth = container.clientWidth;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - previousWidth) < 0.5) return;
      previousWidth = container.clientWidth;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (nearLatestRef.current) {
          scrollToLatest(false);
          return;
        }

        const anchor = visibleAnchorRef.current;
        if (!anchor) return;
        const target = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))
          .find((element) => element.dataset.messageId === anchor.messageId);
        if (!target) return;
        const containerTop = container.getBoundingClientRect().top;
        container.scrollTop += target.getBoundingClientRect().top - containerTop - anchor.viewportOffset;
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [scrollToLatest]);

  React.useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || messages.length === 0 || entryRef.current.anchored) return;

    const firstUnread = preferLatestOnEntry ? undefined : messages.find((message) => (
      message.sender === 'lotus'
      && !message.isProgressUpdate
      && message.timestamp.getTime() > entryRef.current.boundaryMs
    ));

    const placeInitialAnchor = () => {
      if (firstUnread) {
        const target = Array.from(container.querySelectorAll<HTMLElement>('[data-message-id]'))
          .find((element) => element.dataset.messageId === firstUnread.id);
        if (target) {
          const containerTop = container.getBoundingClientRect().top;
          const targetTop = target.getBoundingClientRect().top;
          container.scrollTop += targetTop - containerTop - ANCHOR_TOP_GAP_PX;
          nearLatestRef.current = false;
          handleScroll();
          return;
        }
      }
      scrollToLatest(false);
    };

    entryRef.current.anchored = true;
    placeInitialAnchor();
    const timers = SETTLE_DELAYS_MS.slice(1).map((delay) => window.setTimeout(placeInitialAnchor, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [contextId, handleScroll, messages, preferLatestOnEntry, scrollToLatest]);

  React.useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;
    if (!entryRef.current.anchored || messages.length <= previousCount || !nearLatestRef.current) return;
    const frame = window.requestAnimationFrame(() => scrollToLatest(false));
    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, scrollToLatest]);

  return {
    scrollRef,
    showReturnToLatest,
    scrollToLatest,
    handleScroll,
  };
}
