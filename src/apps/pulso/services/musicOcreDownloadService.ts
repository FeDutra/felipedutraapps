import { collection, getDocs } from "firebase/firestore";
import { db } from "@/shared/lib/firebase/client";
import { firestorePaths } from "./firestorePaths";
import type {
  MusicOcreDownloadClient,
  MusicOcreDownloadMetrics,
  FirestoreDateLike
} from "../types/musicOcreDownload.types";

export function musicOcreDownloadDate(value: FirestoreDateLike): Date | null {
  if (!value) return null;
  if (typeof value === "object" && "toDate" in value) return value.toDate();
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMusicOcreDownloadDate(value: FirestoreDateLike): string {
  const date = musicOcreDownloadDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function computeMusicOcreDownloadMetrics(
  items: MusicOcreDownloadClient[],
  now = new Date()
): MusicOcreDownloadMetrics {
  const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return {
    people: items.length,
    downloads: items.reduce((total, item) => total + Math.max(0, item.downloadCount || 0), 0),
    lastSevenDays: items.filter((item) => {
      const date = musicOcreDownloadDate(item.lastDownloadedAt);
      return date ? date.getTime() >= sevenDaysAgo : false;
    }).length
  };
}

export const musicOcreDownloadService = {
  async getDownloads(): Promise<MusicOcreDownloadClient[]> {
    const snapshot = await getDocs(collection(db, firestorePaths.musicOcreDownloads()));
    const items = snapshot.docs.map((document) => {
      const data = document.data();
      return {
        id: document.id,
        name: data.name ?? "",
        email: data.email ?? "",
        source: data.source ?? "musicaocre.com.br",
        release: data.release ?? "PULSAO_EP_2016",
        downloadCount: Number(data.downloadCount || 0),
        firstDownloadedAt: data.firstDownloadedAt,
        lastDownloadedAt: data.lastDownloadedAt,
        noticeVersion: data.noticeVersion,
        marketingConsent: false as const
      };
    });

    return items.sort((a, b) => {
      const left = musicOcreDownloadDate(a.lastDownloadedAt)?.getTime() || 0;
      const right = musicOcreDownloadDate(b.lastDownloadedAt)?.getTime() || 0;
      return right - left;
    });
  },

  metrics: computeMusicOcreDownloadMetrics,
  formatDate: formatMusicOcreDownloadDate
};
