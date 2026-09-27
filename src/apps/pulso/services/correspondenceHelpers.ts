import type {
  CorrespondenceSubscriberClient,
  CorrespondenceMetrics,
  StatusFilterOption
} from "../types/correspondence.types";

/**
 * Normalizes Firestore date / timestamp / string to Date object
 */
export function toJsDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val?.toDate === "function") return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string" || typeof val === "number") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (val?.seconds) {
    return new Date(val.seconds * 1000);
  }
  return null;
}

/**
 * Formats a timestamp into a compact, ritualistic date string
 */
export function formatCorrespondenceDate(val: any): string {
  const d = toJsDate(val);
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Pure metrics aggregator from subscribers list
 */
export function computeCorrespondenceMetrics(
  subscribers: CorrespondenceSubscriberClient[]
): CorrespondenceMetrics {
  const metrics: CorrespondenceMetrics = {
    total: subscribers.length,
    active: 0,
    pending: 0,
    error: 0,
    unsubscribed: 0
  };

  for (const s of subscribers) {
    if (s.status === "active") metrics.active++;
    else if (s.status === "pending") metrics.pending++;
    else if (s.status === "error") metrics.error++;
    else if (s.status === "unsubscribed") metrics.unsubscribed++;
  }

  return metrics;
}

/**
 * Pure filter and search function for subscribers
 */
export function filterAndSearchSubscribers(
  subscribers: CorrespondenceSubscriberClient[],
  filter: StatusFilterOption,
  searchQuery: string
): CorrespondenceSubscriberClient[] {
  let result = subscribers;

  if (filter !== "all") {
    result = result.filter((s) => s.status === filter);
  }

  const query = searchQuery.trim().toLowerCase();
  if (query.length > 0) {
    result = result.filter((s) => {
      const nameMatch = s.name ? s.name.toLowerCase().includes(query) : false;
      const emailMatch = s.email ? s.email.toLowerCase().includes(query) : false;
      const sourceMatch = s.source ? s.source.toLowerCase().includes(query) : false;
      return nameMatch || emailMatch || sourceMatch;
    });
  }

  return result;
}
