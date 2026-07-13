export type SessionMeta = {
  _id: string;
  sessionId: string;
  createdAt: string;
  state?: "initiated" | "in-progress" | "completed" | "abandoned";
  metadata?: {
    browser?: string;
    browserVersion?: string;
    os?: string;
    screenResolution?: string;
    language?: string;
    startedAt?: string;
  };
  isOnline?: boolean;
  fileUrl?: string;
};

export type ParticipantFile = {
  id: string;
  sessionId: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  url: string;
};

export type TabType = "preview" | "local" | "online";

export type Filters = {
  state: string;
  browser: string;
  os: string;
  resolution: string;
  datePeriod: string;
};

export const EMPTY_FILTERS: Filters = {
  state: "",
  browser: "",
  os: "",
  resolution: "",
  datePeriod: "",
};
