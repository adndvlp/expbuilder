import { afterEach, beforeEach, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  doc: vi.fn((...segments: unknown[]) => segments.slice(1).join("/")),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: vi.fn(() => ({})),
  doc: firestoreMocks.doc,
  getDoc: firestoreMocks.getDoc,
  setDoc: firestoreMocks.setDoc,
  connectFirestoreEmulator: vi.fn(),
}));

vi.mock("../../../pages/ExperimentPanel/AppearanceSettings", () => ({
  default: ({ experimentID }: { experimentID?: string }) => (
    <div data-testid="appearance-settings">Appearance {experimentID}</div>
  ),
}));

vi.mock("../../../pages/ExperimentPanel/CustomDomainSettings", () => ({
  default: ({ experimentID }: { experimentID?: string }) => (
    <div data-testid="custom-domain-settings">Domain {experimentID}</div>
  ),
}));

type SessionToken = {
  id: string;
  type: "date" | "time" | "randomAlpha" | "customText" | "counter";
  dateFormat: string;
  timeFormat: string;
  randomLength: number;
  customValue: string;
  counterDigits: number;
};

function token(overrides: Partial<SessionToken>): SessionToken {
  return {
    id: "token-1",
    type: "counter",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH-mm-ss",
    randomLength: 6,
    customValue: "",
    counterDigits: 3,
    ...overrides,
  };
}

function okJson(payload: unknown): Response {
  return {
    ok: true,
    json: vi.fn(async () => payload),
  } as unknown as Response;
}

function failedResponse(): Response {
  return {
    ok: false,
    json: vi.fn(async () => ({})),
  } as unknown as Response;
}

function existingExperiment(data: Record<string, unknown>) {
  return {
    exists: () => true,
    data: () => data,
  };
}

function missingExperiment() {
  return {
    exists: () => false,
    data: () => ({}),
  };
}

function fetchMock() {
  return vi.mocked(globalThis.fetch);
}

function registerExperimentsettingsHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    firestoreMocks.doc.mockImplementation((...segments: unknown[]) =>
      segments.slice(1).join("/"),
    );
    firestoreMocks.getDoc.mockResolvedValue(missingExperiment());
    firestoreMocks.setDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
}

export {
  existingExperiment,
  failedResponse,
  fetchMock,
  firestoreMocks,
  missingExperiment,
  okJson,
  registerExperimentsettingsHooks,
  token,
};

export type { SessionToken };
