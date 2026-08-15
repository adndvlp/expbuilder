export const MONACO_LOCAL_PERSISTENCE_CONTEXT = `
declare const localOutbox: {
  enqueue(data: unknown): Promise<void>;
  flush(): Promise<{ total: number; acknowledged: number; pending: number; lastSequence: number }>;
  waitForIdle(): Promise<{ total: number; acknowledged: number; pending: number; lastSequence: number }>;
  clear(): Promise<void>;
};
declare let trialSessionId: string;
declare let socket: { emit(event: string, data?: unknown): void } | null;

interface Window {
  JSPSYCH_SESSION_ID?: string;
  JSPSYCH_FILE_UPLOAD_ENDPOINT?: string;
  JSPSYCH_EXPERIMENT_ID?: string;
  JSPSYCH_LOCAL_KEYS?: { jumpTrial: string; [key: string]: string };
}

declare function _showLoading(message?: string): void;
declare function _hideLoading(): void;
declare function _setLoadingMsg(message: string): void;
declare function _showSuccess(): void;

declare let isResuming: boolean;
declare let participantNumber: number;
declare const metadata: {
  browser: string;
  browserVersion: string;
  os: string;
  screenWidth: number;
  screenHeight: number;
  screenResolution: string;
  viewportWidth: number;
  viewportHeight: number;
  language: string;
  userAgent: string;
  startedAt: string;
};
declare function waitForSocket(timeoutMs?: number): Promise<boolean>;
declare function saveSession(sessionId: string): Promise<number>;
declare function _generateSessionName(participantNumber: number | null): string | null;
declare function _setSessionDisplayName(sessionId: string, displayName: string | null): Promise<void>;
declare function _emitPresence(eventName: string, payload: Record<string, unknown>): Promise<boolean>;
declare function _resolveResumeBranch(resumeRaw: string | null): string | null;

declare const resumeRaw: string | null;
declare const existingJump: string | null;
declare const comingFromJumpReload: boolean;
declare function evaluateCondition(trialData: unknown, condition: unknown): boolean;
declare function getNextTrialId(lastTrialData: unknown): string | null;
`;
