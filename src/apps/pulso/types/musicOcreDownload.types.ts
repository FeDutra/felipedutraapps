export type FirestoreDateLike =
  | Date
  | string
  | number
  | { toDate: () => Date }
  | null
  | undefined;

export interface MusicOcreDownloadClient {
  id: string;
  name: string;
  email: string;
  source: string;
  release: string;
  downloadCount: number;
  firstDownloadedAt?: FirestoreDateLike;
  lastDownloadedAt?: FirestoreDateLike;
  noticeVersion?: string;
  marketingConsent: false;
}

export interface MusicOcreDownloadMetrics {
  people: number;
  downloads: number;
  lastSevenDays: number;
}
