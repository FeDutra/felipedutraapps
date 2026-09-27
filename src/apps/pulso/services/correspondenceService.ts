import { collection, getDocs } from "firebase/firestore";
import { db } from "@/shared/lib/firebase/client";
import { firestorePaths } from "./firestorePaths";
import type {
  CorrespondenceSubscriberClient,
  CorrespondenceMetrics,
  StatusFilterOption
} from "../types/correspondence.types";
import {
  toJsDate,
  formatCorrespondenceDate,
  computeCorrespondenceMetrics,
  filterAndSearchSubscribers
} from "./correspondenceHelpers";

export {
  toJsDate,
  formatCorrespondenceDate,
  computeCorrespondenceMetrics,
  filterAndSearchSubscribers
};

/**
 * Correspondence Service for PULSO dashboard
 */
export const correspondenceService = {
  /**
   * Retrieves all correspondence subscribers from Firestore, sorted by createdAt descending
   */
  async getSubscribers(): Promise<CorrespondenceSubscriberClient[]> {
    const colRef = collection(db, firestorePaths.correspondenceSubscribers());
    const snap = await getDocs(colRef);

    const subscribers: CorrespondenceSubscriberClient[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? null,
        email: data.email ?? "",
        source: data.source ?? "web",
        status: data.status ?? "pending",
        consentAt: data.consentAt,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        confirmedAt: data.confirmedAt ?? null,
        unsubscribedAt: data.unsubscribedAt ?? null,
        lastDeliveryStatus: data.lastDeliveryStatus ?? null,
        lastDeliveryAt: data.lastDeliveryAt ?? null,
        errorCode: data.errorCode ?? null
      };
    });

    // In-memory sort by createdAt descending (safeguards against missing index)
    subscribers.sort((a, b) => {
      const dateA = toJsDate(a.createdAt)?.getTime() || 0;
      const dateB = toJsDate(b.createdAt)?.getTime() || 0;
      return dateB - dateA;
    });

    return subscribers;
  },

  computeMetrics: computeCorrespondenceMetrics,
  filterSubscribers: filterAndSearchSubscribers,
  formatDate: formatCorrespondenceDate
};
