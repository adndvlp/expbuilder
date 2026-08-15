export type SessionState =
  | "initiated"
  | "resumed"
  | "in-progress"
  | "completed"
  | "abandoned";

export type SessionMetadata = {
  browser?: string;
  browserVersion?: string;
  os?: string;
  screenResolution?: string;
  language?: string;
  startedAt?: string;
};

export type SessionPresence = {
  sessionId: string;
  state: SessionState;
  connectedAt: string;
  lastUpdate: string;
  metadata?: SessionMetadata;
};

export type SessionMeta = {
  _id?: string;
  sessionId: string;
  experimentID?: string;
  createdAt?: string;
  displayName?: string;
  participantNumber?: number;
  state?: SessionState;
  metadata?: SessionMetadata;
  presence?: SessionPresence;
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
