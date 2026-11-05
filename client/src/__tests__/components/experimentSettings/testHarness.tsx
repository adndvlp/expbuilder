import { defaultFunctionalSettings } from "../../../lib/functionalSettings";
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

const sessionFetch = vi.fn();
const localSettingsFetch = vi.fn();
function localSettings(sections = {}) {
  return {
    functionalSettings: { ...defaultFunctionalSettings(), ...sections },
    revision: 1,
    settingsMigration: { state: "complete", source: "local" },
  };
}
function fetchMock() {
  return sessionFetch;
}

function registerExperimentsettingsHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionFetch
      .mockReset()
      .mockResolvedValue(okJson({ tokens: [], separator: "_" }));
    localSettingsFetch.mockReset().mockResolvedValue(okJson(localSettings()));
    globalThis.fetch = vi.fn((url, init) =>
      String(url).includes("/functional-settings/")
        ? localSettingsFetch(url, init)
        : init === undefined
          ? sessionFetch(url)
          : sessionFetch(url, init),
    ) as typeof fetch;
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
  localSettings,
  localSettingsFetch,
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
